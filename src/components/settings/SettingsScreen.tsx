import React, { useState, useEffect } from 'react';
import {
  Settings,
  Store,
  Printer,
  Barcode,
  Keyboard,
  Shield,
  Save,
  Volume2,
  BellRing,
  RotateCcw,
  Sparkles,
  Key,
  DownloadCloud,
  Database,
  CheckCircle2,
  ExternalLink,
  Moon,
  Sun,
  Users,
  UserPlus,
  Trash2,
  UserCheck,
  ShieldCheck
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { api } from '../../services/api';

export const SettingsScreen: React.FC = () => {
  const {
    cashShift,
    setCashierName: updateGlobalCashierName,
    darkMode,
    setDarkMode,
    toggleDarkMode,
    showToast,
    currentUser,
    changeMyPassword,
    workers,
    createWorker,
    assignWorkerPassword,
    deleteWorker,
    activeWorkerName,
    setActiveWorker
  } = useStore();

  const [storeName, setStoreName] = useState('Mi Tienda Familiar');
  const [storeTaxId, setStoreTaxId] = useState('1792348590001');
  const [storeAddress, setStoreAddress] = useState('Av. Amazonas y Naciones Unidas #402, Quito');
  const [storePhone, setStorePhone] = useState('+593 99 123 4567');
  const [cashierName, setCashierName] = useState(cashShift.cashierName);
  const [ticketFooter, setTicketFooter] = useState('¡Gracias por su compra! Vuelva pronto.');
  const [printerWidth, setPrinterWidth] = useState<'80mm' | '58mm'>('80mm');
  const [soundFeedback, setSoundFeedback] = useState(true);
  const [isGeneratingBackup, setIsGeneratingBackup] = useState(false);

  // New Worker / User State
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerUsername, setNewWorkerUsername] = useState('');
  const [newWorkerPassword, setNewWorkerPassword] = useState('');
  const [newWorkerRole, setNewWorkerRole] = useState('CAJERO');
  const [isSubmittingWorker, setIsSubmittingWorker] = useState(false);
  const [editingPwdWorkerId, setEditingPwdWorkerId] = useState<number | null>(null);
  const [workerNewPassword, setWorkerNewPassword] = useState('');

  // Own Password Change State
  const [myCurrentPwd, setMyCurrentPwd] = useState('');
  const [myNewPwd, setMyNewPwd] = useState('');
  const [isChangingMyPwd, setIsChangingMyPwd] = useState(false);

  // AI Configuration State
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [isAiConfigured, setIsAiConfigured] = useState(false);
  const [isSavingAiKey, setIsSavingAiKey] = useState(false);

  useEffect(() => {
    api.getConfiguracion().then(conf => {
      if (conf.NOMBRE_TIENDA) setStoreName(conf.NOMBRE_TIENDA);
      if (conf.RUC_TIENDA) setStoreTaxId(conf.RUC_TIENDA);
      if (conf.DIRECCION_TIENDA) setStoreAddress(conf.DIRECCION_TIENDA);
      if (conf.TELEFONO_TIENDA) setStorePhone(conf.TELEFONO_TIENDA);
      if (conf.PIE_TICKET) setTicketFooter(conf.PIE_TICKET);
      if (conf.FORMATO_IMPRESORA === '58mm' || conf.FORMATO_IMPRESORA === '80mm') {
        setPrinterWidth(conf.FORMATO_IMPRESORA);
      }
    }).catch(() => {});

    api.getIAConfig().then(res => {
      setIsAiConfigured(res.configurado);
      if (res.api_key_mascara) {
        setGeminiApiKey(res.api_key_mascara);
      }
    }).catch(() => {});
  }, []);

  const handleSaveAiKey = async () => {
    if (!geminiApiKey.trim() || geminiApiKey.startsWith('AIza...')) {
      showToast('Ingresa una clave válida de Gemini');
      return;
    }
    try {
      setIsSavingAiKey(true);
      await api.saveIAConfig(geminiApiKey.trim());
      setIsAiConfigured(true);
      showToast('API Key de Gemini guardada con éxito');
    } catch (e) {
      showToast('Error al guardar la API Key');
    } finally {
      setIsSavingAiKey(false);
    }
  };

  const handleGenerateBackup = async () => {
    try {
      setIsGeneratingBackup(true);
      const res = await api.generarBackup();
      if (res.success) {
        showToast(`Backup generado: ${res.filename} (${(res.size_bytes / 1024).toFixed(1)} KB)`);
        window.open(api.getBackupDownloadUrl(res.filename), '_blank');
      }
    } catch (e) {
      showToast('Error al generar backup');
    } finally {
      setIsGeneratingBackup(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cashierName.trim()) {
      updateGlobalCashierName(cashierName.trim());
    }
    try {
      await api.guardarConfiguracion({
        NOMBRE_TIENDA: storeName,
        RUC_TIENDA: storeTaxId,
        DIRECCION_TIENDA: storeAddress,
        TELEFONO_TIENDA: storePhone,
        PIE_TICKET: ticketFooter,
        FORMATO_IMPRESORA: printerWidth
      });
      showToast('Configuraciones guardadas exitosamente');
    } catch (e) {
      showToast('Configuraciones guardadas localmente');
    }
  };

  return (
    <div className="workspace-screen flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[var(--ui-surface-muted)] select-none">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <p className="workspace-eyebrow mb-1">Administración del negocio</p>
          <h1 className="workspace-heading font-bold text-xl md:text-2xl text-[var(--ui-text)]">
            Ajustes del Sistema
          </h1>
          <p className="text-xs md:text-sm text-[var(--ui-muted)] mt-0.5">
            Personalización de tienda, visión con IA, caja registradora y atajos de teclado.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Appearance / Theme */}
          <div className="surface-card bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base text-[var(--ui-text)] flex items-center gap-2">
                  {darkMode ? <Moon className="w-5 h-5 text-[var(--ui-mint)]" /> : <Sun className="w-5 h-5 text-[var(--ui-warning-text)]" />}
                  <span>Apariencia y Modo Visual</span>
                </h2>
                <p className="text-xs text-[var(--ui-muted)] mt-0.5">
                  Selecciona el tema que mejor se adapte a tu iluminación y preferencia de trabajo.
                </p>
              </div>

              {/* Quick Switch Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--ui-text)]">
                  {darkMode ? '🌙 Modo Oscuro' : '☀️ Modo Claro'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={darkMode}
                  onClick={() => {
                    const next = !darkMode;
                    setDarkMode(next);
                    showToast(next ? '🌙 Modo Oscuro activado' : '☀️ Modo Claro activado');
                  }}
                  className={`relative w-12 h-6.5 rounded-full transition-colors duration-200 shrink-0 cursor-pointer px-0.5 flex items-center ${
                    darkMode ? 'bg-[var(--ui-brand)] justify-end' : 'bg-[var(--ui-border)] justify-start'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-[var(--ui-surface)] shadow-md flex items-center justify-center">
                    {darkMode ? <Moon className="w-3 h-3 text-[var(--ui-brand-strong)]" /> : <Sun className="w-3 h-3 text-[var(--ui-warning-text)]" />}
                  </span>
                </button>
              </div>
            </div>

            {/* Theme Visual Selection Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Card 1: Modo Claro */}
              <button
                type="button"
                onClick={() => {
                  setDarkMode(false);
                  showToast('☀️ Modo Claro activado');
                }}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                  !darkMode
                    ? 'border-[var(--ui-brand)] bg-[var(--ui-brand-soft)] shadow-sm ring-2 ring-[var(--ui-brand)]/20'
                    : 'border-[var(--ui-border)] bg-[var(--ui-surface)] hover:border-[var(--ui-border)] opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[var(--ui-warning-bg)] text-[var(--ui-warning-text)] flex items-center justify-center font-bold">
                      <Sun className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs md:text-sm text-[var(--ui-text)]">Modo Claro</h3>
                      <p className="text-[10px] text-[var(--ui-muted)]">Luminoso y de alto contraste</p>
                    </div>
                  </div>

                  {!darkMode && (
                    <span className="px-2 py-0.5 rounded-full bg-[var(--ui-brand)] text-white font-mono text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>ACTIVO</span>
                    </span>
                  )}
                </div>

                {/* Light Theme Mini Preview Mock */}
                <div className="theme-preview-light w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg p-2 space-y-1.5 shadow-2xs pointer-events-none">
                  <div className="h-2.5 w-1/3 bg-[var(--ui-brand)] rounded-xs" />
                  <div className="flex gap-1.5">
                    <div className="w-1/4 h-8 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xs" />
                    <div className="w-3/4 h-8 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xs p-1 space-y-1">
                      <div className="h-1.5 w-full bg-[var(--ui-surface-hover)] rounded-xs" />
                      <div className="h-1.5 w-2/3 bg-[var(--ui-border)] rounded-xs" />
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-[var(--ui-secondary)] mt-2.5">
                  Ideal para jornadas con iluminación natural o abundante luz en el local comercial.
                </p>
              </button>

              {/* Card 2: Modo Oscuro */}
              <button
                type="button"
                onClick={() => {
                  setDarkMode(true);
                  showToast('🌙 Modo Oscuro activado');
                }}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                  darkMode
                    ? 'border-[var(--ui-mint)] bg-[var(--ui-chrome)] shadow-sm ring-2 ring-[var(--ui-mint)]/30'
                    : 'border-[var(--ui-border)] bg-[var(--ui-chrome)] text-white hover:border-[var(--ui-border)] opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[var(--ui-chrome-raised)] text-[var(--ui-mint)] flex items-center justify-center font-bold">
                      <Moon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs md:text-sm text-white">Modo Oscuro</h3>
                      <p className="text-[10px] text-[var(--ui-subtle)]">Elegante y descanso visual</p>
                    </div>
                  </div>

                  {darkMode && (
                    <span className="px-2 py-0.5 rounded-full bg-[var(--ui-mint)] text-[#152a3f] font-mono text-[10px] font-black flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>ACTIVO</span>
                    </span>
                  )}
                </div>

                {/* Dark Theme Mini Preview Mock */}
                <div className="w-full bg-[var(--ui-chrome-raised)] border border-[var(--ui-border-strong)] rounded-lg p-2 space-y-1.5 shadow-2xs pointer-events-none">
                  <div className="h-2.5 w-1/3 bg-[var(--ui-mint)] rounded-xs" />
                  <div className="flex gap-1.5">
                    <div className="w-1/4 h-8 bg-[var(--ui-chrome)] border border-[var(--ui-border-strong)] rounded-xs" />
                    <div className="w-3/4 h-8 bg-[var(--ui-chrome)] border border-[var(--ui-border-strong)] rounded-xs p-1 space-y-1">
                      <div className="h-1.5 w-full bg-[var(--ui-chrome-raised)] rounded-xs" />
                      <div className="h-1.5 w-2/3 bg-[var(--ui-border-strong)] rounded-xs" />
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-[var(--ui-subtle)] mt-2.5">
                  Reduce la fatiga ocular en turnos de noche o ambientes de baja luz y ahorra energía en pantallas OLED/LCD.
                </p>
              </button>
            </div>
          </div>

          {/* Store Information */}
          <div className="surface-card bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl p-5 shadow-xs">
            <h2 className="font-bold text-base text-[var(--ui-text)] mb-4 flex items-center gap-2">
              <Store className="w-5 h-5 text-[var(--ui-brand-strong)]" />
              <span>Datos del Negocio / Comprobantes</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm">
              <div>
                <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                  Nombre Comercial
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                  RUC / Identificación Tributaria
                </label>
                <input
                  type="text"
                  value={storeTaxId}
                  onChange={(e) => setStoreTaxId(e.target.value)}
                  className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 font-mono text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                  Dirección del Local
                </label>
                <input
                  type="text"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  value={storePhone}
                  onChange={(e) => setStorePhone(e.target.value)}
                  className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 font-mono text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                />
              </div>
            </div>
          </div>

          {/* Store Workers / Staff & Users Card */}
          <div className="surface-card bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base text-[var(--ui-text)] flex items-center gap-2">
                  <Users className="w-5 h-5 text-[var(--ui-brand-strong)]" />
                  <span>Usuarios y Personal de la Tienda (Accesos y Turnos)</span>
                </h2>
                <p className="text-xs text-[var(--ui-muted)] mt-0.5">
                  Crea cuentas de acceso para administradores o cajeros de esta tienda, o registra trabajadores de turno para el mostrador.
                </p>
              </div>
            </div>

            {/* Quick Add Form */}
            <div className="bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-xl p-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ui-secondary)] mb-1">
                    Nombre completo *
                  </label>
                  <input
                    type="text"
                    value={newWorkerName}
                    onChange={(e) => setNewWorkerName(e.target.value)}
                    placeholder="Ej. María Gómez"
                    className="w-full bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-xs md:text-sm text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--ui-secondary)] mb-1">
                    Usuario (login opcional)
                  </label>
                  <input
                    type="text"
                    value={newWorkerUsername}
                    onChange={(e) => setNewWorkerUsername(e.target.value)}
                    placeholder="Ej. maria_caja"
                    className="w-full bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg px-3 py-2 font-mono text-xs md:text-sm text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--ui-secondary)] mb-1">
                    Contraseña (mín. 8 caract.)
                  </label>
                  <input
                    type="password"
                    value={newWorkerPassword}
                    onChange={(e) => setNewWorkerPassword(e.target.value)}
                    placeholder="Vacío = solo turno sin login"
                    className="w-full bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-xs md:text-sm text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--ui-secondary)] mb-1">
                    Rol asignado
                  </label>
                  <select
                    value={newWorkerRole}
                    onChange={(e) => setNewWorkerRole(e.target.value)}
                    className="w-full bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-xs md:text-sm text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                  >
                    <option value="CAJERO">Cajero / Turno</option>
                    <option value="ADMINISTRADOR">Administrador</option>
                    <option value="BODEGUERO">Bodeguero</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
                <p className="text-[11px] text-[var(--ui-muted)]">
                  💡 Si defines una contraseña (mínimo 8 caracteres), el usuario podrá iniciar sesión con su propio usuario y clave.
                </p>
                <button
                  type="button"
                  disabled={isSubmittingWorker || !newWorkerName.trim()}
                  onClick={async () => {
                    if (!newWorkerName.trim()) return;
                    if (newWorkerPassword && newWorkerPassword.length < 8) {
                      showToast('⚠️ La contraseña debe tener al menos 8 caracteres');
                      return;
                    }
                    try {
                      setIsSubmittingWorker(true);
                      await createWorker(
                        newWorkerName.trim(),
                        newWorkerRole,
                        newWorkerUsername.trim() || undefined,
                        newWorkerPassword || undefined
                      );
                      setNewWorkerName('');
                      setNewWorkerUsername('');
                      setNewWorkerPassword('');
                    } catch {
                      // Error toast already shown in createWorker
                    } finally {
                      setIsSubmittingWorker(false);
                    }
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] disabled:bg-[var(--ui-border)] text-white font-bold rounded-lg text-xs md:text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs shrink-0"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isSubmittingWorker ? 'Guardando...' : 'Crear Usuario / Trabajador'}</span>
                </button>
              </div>
            </div>

            {/* Workers List */}
            <div className="divide-y divide-[var(--ui-border)] border border-[var(--ui-border)] rounded-xl overflow-hidden bg-[var(--ui-surface)]">
              {workers.map((w) => {
                const isActive = w.name.trim().toLowerCase() === (activeWorkerName || cashShift.cashierName || '').trim().toLowerCase();
                const isMainAdmin = w.id === 1;
                const isEditingPwd = editingPwdWorkerId === w.id;

                return (
                  <div
                    key={w.id}
                    className={`p-3.5 flex flex-col gap-2.5 transition-colors ${
                      isActive ? 'bg-[var(--ui-brand-soft)]' : 'hover:bg-[var(--ui-surface-muted)]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                          isActive
                            ? 'bg-[var(--ui-brand)] text-white ring-2 ring-[var(--ui-brand)]/30'
                            : 'bg-[var(--ui-surface-hover)] text-[var(--ui-secondary)]'
                        }`}>
                          {w.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-xs md:text-sm text-[var(--ui-text)]">{w.name}</p>
                            <span className="text-[11px] font-mono text-[var(--ui-muted)]">@{w.username}</span>
                            <span className={`text-[10px] font-mono px-2 py-0.2 rounded-full font-bold uppercase ${
                              w.role === 'ADMINISTRADOR'
                                ? 'bg-[var(--ui-info-bg)] text-[var(--ui-info-text)] border border-[var(--ui-info-border)]'
                                : 'bg-[var(--ui-surface-hover)] text-[var(--ui-secondary)] border border-[var(--ui-border)]'
                            }`}>
                              {w.role}
                            </span>
                            <span className={`text-[10px] px-2 py-0.2 rounded-full font-semibold ${
                              w.canLogin
                                ? 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20'
                                : 'bg-[var(--ui-surface-muted)] text-[var(--ui-muted)] border border-[var(--ui-border)]'
                            }`}>
                              {w.canLogin ? '🔑 Acceso con clave' : 'Solo turno'}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--ui-muted)]">
                            {isActive ? '🟢 Atendiendo la tienda en este momento' : 'Turno inactivo'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPwdWorkerId(isEditingPwd ? null : w.id);
                            setWorkerNewPassword('');
                          }}
                          className="px-2.5 py-1 bg-[var(--ui-surface)] hover:bg-[var(--ui-surface-hover)] text-[var(--ui-secondary)] text-xs font-semibold rounded-lg border border-[var(--ui-border)] transition-all cursor-pointer flex items-center gap-1"
                          title="Asignar o cambiar contraseña de acceso para este usuario"
                        >
                          <Key className="w-3.5 h-3.5 text-[var(--ui-brand-strong)]" />
                          <span>{w.canLogin ? 'Cambiar clave' : 'Dar clave'}</span>
                        </button>

                        {isActive ? (
                          <span className="px-3 py-1 bg-[var(--ui-brand)] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>EN TURNO AHORA</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveWorker(w.name)}
                            className="px-3 py-1 bg-[var(--ui-surface-hover)] hover:bg-[var(--ui-surface-hover)] text-[var(--ui-text)] text-xs font-semibold rounded-lg border border-[var(--ui-border)] transition-all cursor-pointer flex items-center gap-1"
                            title="Asignar como la persona a cargo del mostrador ahora"
                          >
                            <UserCheck className="w-3.5 h-3.5 text-[var(--ui-brand-strong)]" />
                            <span>Poner a cargo</span>
                          </button>
                        )}

                        {!isMainAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`¿Seguro que deseas eliminar a "${w.name}" de la lista de trabajadores?`)) {
                                deleteWorker(w.id);
                              }
                            }}
                            className="p-1.5 text-[var(--ui-subtle)] hover:text-[var(--ui-danger-text)] hover:bg-[var(--ui-danger-bg)] rounded-lg transition-colors cursor-pointer"
                            title="Eliminar trabajador"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditingPwd && (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-[var(--ui-border)]">
                        <input
                          type="password"
                          value={workerNewPassword}
                          onChange={(e) => setWorkerNewPassword(e.target.value)}
                          placeholder={`Nueva contraseña para @${w.username} (mín. 8 caracteres)`}
                          className="flex-1 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              if (workerNewPassword.length < 8) {
                                showToast('⚠️ La contraseña debe tener al menos 8 caracteres');
                                return;
                              }
                              try {
                                await assignWorkerPassword(w.id, workerNewPassword);
                                setEditingPwdWorkerId(null);
                                setWorkerNewPassword('');
                              } catch (err: any) {
                                showToast(`⚠️ ${err?.message || 'Error al asignar contraseña'}`);
                              }
                            }}
                            className="px-3 py-1.5 bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white text-xs font-bold rounded-lg cursor-pointer"
                          >
                            Guardar clave
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPwdWorkerId(null);
                              setWorkerNewPassword('');
                            }}
                            className="px-2.5 py-1.5 text-xs text-[var(--ui-muted)] hover:text-[var(--ui-text)] cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Account Password Security Card */}
          <div className="surface-card bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl p-5 shadow-xs space-y-3">
            <h2 className="font-bold text-base text-[var(--ui-text)] flex items-center gap-2">
              <Shield className="w-5 h-5 text-[var(--ui-brand-strong)]" />
              <span>Seguridad de tu Cuenta ({currentUser?.username || 'admin'})</span>
            </h2>
            <p className="text-xs text-[var(--ui-muted)]">
              Cambia tu contraseña actual de inicio de sesión. Al actualizarla, las sesiones abiertas en otros dispositivos se cerrarán automáticamente.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end pt-1">
              <div>
                <label className="block text-xs font-semibold text-[var(--ui-secondary)] mb-1">
                  Contraseña actual
                </label>
                <input
                  type="password"
                  value={myCurrentPwd}
                  onChange={(e) => setMyCurrentPwd(e.target.value)}
                  placeholder="Contraseña actual"
                  className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-xs md:text-sm text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--ui-secondary)] mb-1">
                  Nueva contraseña (mín. 8 caract.)
                </label>
                <input
                  type="password"
                  value={myNewPwd}
                  onChange={(e) => setMyNewPwd(e.target.value)}
                  placeholder="Nueva contraseña segura"
                  className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-xs md:text-sm text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                />
              </div>
              <button
                type="button"
                disabled={isChangingMyPwd || !myCurrentPwd || myNewPwd.length < 8}
                onClick={async () => {
                  try {
                    setIsChangingMyPwd(true);
                    await changeMyPassword(myCurrentPwd, myNewPwd);
                    setMyCurrentPwd('');
                    setMyNewPwd('');
                  } catch (err: any) {
                    showToast(`⚠️ ${err?.message || 'Error al actualizar contraseña'}`);
                  } finally {
                    setIsChangingMyPwd(false);
                  }
                }}
                className="px-4 py-2 bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] disabled:bg-[var(--ui-border)] text-white font-bold rounded-lg text-xs md:text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isChangingMyPwd ? 'Actualizando...' : 'Actualizar mi clave'}</span>
              </button>
            </div>
          </div>

          {/* AI Vision Configuration */}
          <div className="surface-card bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-base text-[var(--ui-text)] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[var(--ui-brand-strong)]" />
                <span>Inteligencia Artificial (Visión Google Gemini)</span>
              </h2>

              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                isAiConfigured ? 'bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)] border border-[var(--ui-brand-soft-border)]' : 'bg-[var(--ui-warning-bg)] text-[var(--ui-warning-text)] border border-[var(--ui-warning-border)]'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isAiConfigured ? 'bg-[var(--ui-brand)]' : 'bg-[var(--ui-warning-solid)]'}`} />
                <span>{isAiConfigured ? 'Servicio Activo' : 'Pendiente de Clave'}</span>
              </span>
            </div>

            <p className="text-xs text-[var(--ui-muted)] mb-4 leading-relaxed">
              Permite el escaneo automático de facturas con fotos o cámara web en la pantalla de recepción de mercancía.
            </p>

            <div className="bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-xl p-4 space-y-3 text-xs md:text-sm">
              <div>
                <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                  Google Gemini API Key
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Key className="w-4 h-4 text-[var(--ui-muted)] absolute left-3 top-2.5" />
                    <input
                      type="password"
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      placeholder="Pega aquí tu API Key de Gemini (ej: AIzaSy...)"
                      className="w-full pl-9 pr-3 py-2 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg font-mono text-xs text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveAiKey}
                    disabled={isSavingAiKey}
                    className="px-4 py-2 bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white font-bold text-xs rounded-lg shadow-xs transition-colors shrink-0"
                  >
                    {isSavingAiKey ? 'Guardando...' : 'Guardar Clave'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[var(--ui-muted)] pt-1">
                <span>¿No tienes una clave? Es 100% gratuita.</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--ui-brand-strong)] font-bold hover:underline inline-flex items-center gap-1"
                >
                  <span>Obtener clave gratis en Google AI Studio</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Ticket Printer & POS Settings */}
          <div className="surface-card bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl p-5 shadow-xs">
            <h2 className="font-bold text-base text-[var(--ui-text)] mb-4 flex items-center gap-2">
              <Printer className="w-5 h-5 text-[var(--ui-brand-strong)]" />
              <span>Impresora Térmica de Tickets</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm">
              <div>
                <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                  Ancho de Papel
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 p-2.5 border border-[var(--ui-border)] rounded-lg cursor-pointer bg-[var(--ui-surface-muted)] flex-1">
                    <input
                      type="radio"
                      name="printerWidth"
                      value="80mm"
                      checked={printerWidth === '80mm'}
                      onChange={() => setPrinterWidth('80mm')}
                      className="text-[var(--ui-brand-strong)] focus:ring-0"
                    />
                    <span className="font-semibold text-xs text-[var(--ui-text)]">80 mm (Estándar POS)</span>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 border border-[var(--ui-border)] rounded-lg cursor-pointer bg-[var(--ui-surface-muted)] flex-1">
                    <input
                      type="radio"
                      name="printerWidth"
                      value="58mm"
                      checked={printerWidth === '58mm'}
                      onChange={() => setPrinterWidth('58mm')}
                      className="text-[var(--ui-brand-strong)] focus:ring-0"
                    />
                    <span className="font-semibold text-xs text-[var(--ui-text)]">58 mm (Portátil)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                  Pie de Ticket (Mensaje de despedida)
                </label>
                <input
                  type="text"
                  value={ticketFooter}
                  onChange={(e) => setTicketFooter(e.target.value)}
                  className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-xl col-span-1 md:col-span-2">
                <div className="flex items-center gap-2.5">
                  <Volume2 className="w-4 h-4 text-[var(--ui-brand-strong)]" />
                  <div>
                    <p className="font-bold text-xs text-[var(--ui-text)]">Sonidos de Confirmación y Alerta</p>
                    <p className="text-[11px] text-[var(--ui-muted)]">Emite sonidos audibles al escanear, cobrar o emitir alertas.</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={soundFeedback}
                  onChange={(e) => setSoundFeedback(e.target.checked)}
                  className="w-4 h-4 text-[var(--ui-brand-strong)] rounded focus:ring-0 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Backups & Maintenance */}
          <div className="surface-card bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl p-5 shadow-xs">
            <h2 className="font-bold text-base text-[var(--ui-text)] mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-[var(--ui-brand-strong)]" />
              <span>Base de Datos y Copias de Seguridad (Backups)</span>
            </h2>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-[var(--ui-surface-muted)] rounded-xl border border-[var(--ui-border)] gap-3">
              <div>
                <p className="font-bold text-xs md:text-sm text-[var(--ui-text)]">
                  Snapshot Comprimido de Base de Datos (.db.gz)
                </p>
                <p className="text-xs text-[var(--ui-muted)] mt-0.5">
                  Genera una copia íntegra e inmutable de todas las ventas, compras, productos y el Kardex.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGenerateBackup}
                disabled={isGeneratingBackup}
                className="bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm flex items-center gap-2 shadow-xs transition-all shrink-0 cursor-pointer"
              >
                <DownloadCloud className="w-4 h-4 text-[var(--ui-mint)]" />
                <span>{isGeneratingBackup ? 'Generando...' : 'Generar y Descargar Backup'}</span>
              </button>
            </div>
          </div>

          {/* Keyboard Shortcuts Cheatsheet */}
          <div className="surface-card bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl p-5 shadow-xs">
            <h2 className="font-bold text-base text-[var(--ui-text)] mb-4 flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-[var(--ui-secondary)]" />
              <span>Guía Rápida de Atajos de Teclado (Hotkeys)</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg flex items-center justify-between">
                <span className="font-medium text-[var(--ui-secondary)]">Venta Rápida 1</span>
                <kbd className="font-mono bg-[var(--ui-chrome)] text-white px-2 py-0.5 rounded font-bold text-[11px]">[F1]</kbd>
              </div>
              <div className="p-2.5 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg flex items-center justify-between">
                <span className="font-medium text-[var(--ui-secondary)]">Venta Rápida 2</span>
                <kbd className="font-mono bg-[var(--ui-chrome)] text-white px-2 py-0.5 rounded font-bold text-[11px]">[F2]</kbd>
              </div>
              <div className="p-2.5 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg flex items-center justify-between">
                <span className="font-medium text-[var(--ui-secondary)]">Foco Escáner / Búsqueda</span>
                <kbd className="font-mono bg-[var(--ui-chrome)] text-white px-2 py-0.5 rounded font-bold text-[11px]">[F3]</kbd>
              </div>
              <div className="p-2.5 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg flex items-center justify-between">
                <span className="font-medium text-[var(--ui-secondary)]">Venta Rápida 3</span>
                <kbd className="font-mono bg-[var(--ui-chrome)] text-white px-2 py-0.5 rounded font-bold text-[11px]">[F4]</kbd>
              </div>
              <div className="p-2.5 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg flex items-center justify-between">
                <span className="font-medium text-[var(--ui-secondary)]">Confirmar Cobro</span>
                <kbd className="font-mono bg-[var(--ui-brand)] text-white px-2 py-0.5 rounded font-bold text-[11px]">[F5]</kbd>
              </div>
              <div className="p-2.5 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg flex items-center justify-between">
                <span className="font-medium text-[var(--ui-secondary)]">Guardar Recepción Compra</span>
                <kbd className="font-mono bg-[var(--ui-brand)] text-white px-2 py-0.5 rounded font-bold text-[11px]">[F10]</kbd>
              </div>
              <div className="p-2.5 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg flex items-center justify-between">
                <span className="font-medium text-[var(--ui-secondary)]">Cerrar Caja / Reporte Z</span>
                <kbd className="font-mono bg-[var(--ui-brand)] text-white px-2 py-0.5 rounded font-bold text-[11px]">[F12]</kbd>
              </div>
              <div className="p-2.5 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg flex items-center justify-between">
                <span className="font-medium text-[var(--ui-secondary)]">Buscador Global</span>
                <kbd className="font-mono bg-[var(--ui-chrome)] text-white px-2 py-0.5 rounded font-bold text-[11px]">⌘K / Ctrl+K</kbd>
              </div>
              <div className="p-2.5 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg flex items-center justify-between">
                <span className="font-medium text-[var(--ui-secondary)]">Cerrar Ventana</span>
                <kbd className="font-mono bg-[var(--ui-muted)] text-white px-2 py-0.5 rounded font-bold text-[11px]">ESC</kbd>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4 text-[var(--ui-mint)]" />
              <span>Guardar Configuraciones</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
