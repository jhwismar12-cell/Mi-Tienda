import React, { useRef, useState } from 'react';
import { Check, PlusCircle, Truck, X } from 'lucide-react';
import { api } from '../../services/api';
import { StoreProviderOption } from '../../utils/providers';

export const NEW_PROVIDER_OPTION = '__NEW__';

interface ProviderSelectorFieldProps {
  providers: StoreProviderOption[];
  selectedProviderId?: number;
  onSelectProvider: (provider?: { id: number; name: string }) => void;
  onProviderCreated: (created: StoreProviderOption) => void;
  labelClassName?: string;
}

/**
 * Reusable distributor selector with inline creation for product forms.
 * Uses plain buttons + div (never a nested <form>) so it embeds safely inside modal forms.
 */
export const ProviderSelectorField: React.FC<ProviderSelectorFieldProps> = ({
  providers,
  selectedProviderId,
  onSelectProvider,
  onProviderCreated,
  labelClassName = 'text-xs font-semibold text-[var(--ui-secondary)]'
}) => {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRuc, setNewRuc] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSavingProvider, setIsSavingProvider] = useState(false);
  const savingRef = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const openInlineNew = () => {
    setErrorMsg(null);
    setIsAddingNew(true);
    setTimeout(() => nameInputRef.current?.focus(), 20);
  };

  const closeInlineNew = () => {
    setIsAddingNew(false);
    setNewName('');
    setNewRuc('');
    setNewPhone('');
    setErrorMsg(null);
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === NEW_PROVIDER_OPTION) {
      openInlineNew();
      return;
    }
    if (!val) {
      onSelectProvider(undefined);
      return;
    }
    const found = providers.find(p => p.id_proveedor === Number(val));
    if (found) {
      onSelectProvider({ id: found.id_proveedor, name: found.razon_social });
    }
  };

  const handleCreateProvider = async () => {
    if (savingRef.current) return;
    const cleanName = newName.trim();
    if (!cleanName) {
      setErrorMsg('Escribe el nombre o razón social del distribuidor.');
      nameInputRef.current?.focus();
      return;
    }

    setErrorMsg(null);
    savingRef.current = true;
    setIsSavingProvider(true);
    try {
      const created = await api.crearProveedor({
        razon_social: cleanName,
        ruc_ci: newRuc.trim() || `RUC-${Date.now()}`,
        telefono: newPhone.trim() || undefined
      });
      const option: StoreProviderOption = {
        id_proveedor: created.id_proveedor,
        ruc_ci: created.ruc_ci,
        razon_social: created.razon_social
      };
      onProviderCreated(option);
      onSelectProvider({ id: option.id_proveedor, name: option.razon_social });
      closeInlineNew();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo registrar el distribuidor.');
    } finally {
      savingRef.current = false;
      setIsSavingProvider(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className={`flex items-center gap-1.5 ${labelClassName}`}>
          <Truck className="w-3.5 h-3.5 text-[var(--ui-brand-strong)]" />
          <span>Distribuidor / Proveedor (Opcional)</span>
        </label>
        <button
          type="button"
          onClick={() => (isAddingNew ? closeInlineNew() : openInlineNew())}
          className="text-[11px] font-bold text-[var(--ui-brand-strong)] hover:underline inline-flex items-center gap-1 cursor-pointer"
          title={isAddingNew ? 'Cancelar nuevo distribuidor' : 'Añadir un distribuidor nuevo'}
        >
          {isAddingNew ? (
            <>
              <X className="w-3 h-3" />
              <span>Cerrar</span>
            </>
          ) : (
            <>
              <PlusCircle className="w-3 h-3" />
              <span>+ Nuevo distribuidor</span>
            </>
          )}
        </button>
      </div>

      <select
        aria-label="Distribuidor"
        value={selectedProviderId ? String(selectedProviderId) : ''}
        onChange={handleSelectChange}
        className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded-xl px-3 py-2 text-xs sm:text-sm text-[var(--ui-text)] outline-none"
      >
        <option value="">Sin distribuidor / General</option>
        {providers.map(p => (
          <option key={p.id_proveedor} value={String(p.id_proveedor)}>
            {p.razon_social}
          </option>
        ))}
        <option value={NEW_PROVIDER_OPTION}>+ Añadir distribuidor nuevo...</option>
      </select>

      {isAddingNew && (
        <div className="p-3 rounded-xl bg-[var(--ui-brand-soft)] border border-[var(--ui-brand-soft-border)] space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[var(--ui-brand-strong)] flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" />
              <span>Registrar nuevo distribuidor</span>
            </span>
          </div>

          {errorMsg && (
            <div className="px-2.5 py-1.5 rounded-lg bg-[var(--ui-danger-bg)] border border-[var(--ui-danger-border)] text-[var(--ui-danger-text)] text-[11px] font-semibold">
              {errorMsg}
            </div>
          )}

          <div>
            <input
              ref={nameInputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCreateProvider();
                }
              }}
              placeholder="Nombre o Razón Social *"
              aria-label="Nombre del nuevo distribuidor"
              className="w-full px-3 py-1.5 bg-[var(--ui-surface)] border border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded-lg text-xs text-[var(--ui-text)] outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newRuc}
              onChange={(e) => setNewRuc(e.target.value)}
              placeholder="RUC / Cédula (Opcional)"
              aria-label="RUC o Cédula del distribuidor"
              className="w-full px-2.5 py-1.5 bg-[var(--ui-surface)] border border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded-lg text-xs font-mono text-[var(--ui-text)] outline-none"
            />
            <input
              type="text"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Teléfono (Opcional)"
              aria-label="Teléfono del distribuidor"
              className="w-full px-2.5 py-1.5 bg-[var(--ui-surface)] border border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded-lg text-xs font-mono text-[var(--ui-text)] outline-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeInlineNew}
              className="px-2.5 py-1.5 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[11px] font-semibold text-[var(--ui-secondary)] hover:bg-[var(--ui-surface-hover)] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isSavingProvider}
              onClick={handleCreateProvider}
              className="px-3 py-1.5 rounded-lg bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] disabled:opacity-50 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 text-[var(--ui-mint)]" />
              <span>{isSavingProvider ? 'Guardando...' : 'Guardar Distribuidor'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
