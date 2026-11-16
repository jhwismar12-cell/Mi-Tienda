import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Product } from '../../types';

interface DeleteProductModalProps {
  product: Product | null;
  isDeleting?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export const DeleteProductModal: React.FC<DeleteProductModalProps> = ({
  product,
  isDeleting = false,
  onClose,
  onConfirm
}) => {
  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-product-title"
        className="bg-[var(--ui-surface)] rounded-2xl border border-[var(--ui-border)] shadow-2xl max-w-md w-full overflow-hidden"
      >
        <div className="px-5 py-4 bg-[var(--ui-danger-bg)] border-b border-[var(--ui-danger-border)] flex items-center gap-2.5 text-[var(--ui-danger-text)]">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <h2 id="delete-product-title" className="font-bold text-base">
            Eliminar Producto de Raíz
          </h2>
        </div>

        <div className="p-5 space-y-3 text-xs md:text-sm text-[var(--ui-text)]">
          <p>
            ¿Seguro que deseas eliminar permanentemente{' '}
            <strong>{product.name}</strong> ({product.code})?
          </p>
          <p className="text-xs text-[var(--ui-muted)]">
            Esta acción quita el producto del catálogo y libera su código de barras si ya no se va a vender. (Si tiene ventas o compras históricas previas, esos recibos antiguos se conservan sin mostrarlo en el catálogo activo.)
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--ui-border)]">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-semibold text-[var(--ui-secondary)] hover:bg-[var(--ui-surface-hover)] rounded-xl border border-[var(--ui-border)] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-bold text-white bg-[var(--ui-danger-solid)] hover:opacity-90 disabled:opacity-50 rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDeleting ? 'Eliminando...' : 'Sí, eliminar de raíz'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
