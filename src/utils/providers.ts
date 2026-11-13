import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { Product } from '../types';

export interface StoreProviderOption {
  id_proveedor: number;
  ruc_ci: string;
  razon_social: string;
}

/**
 * Merges backend provider rows with any providers already referenced on loaded products,
 * deduplicating by id_proveedor and sorting alphabetically (Spanish locale).
 */
export function mergeProviderOptions(
  remote: Array<{ id_proveedor: number; ruc_ci?: string; razon_social: string }>,
  products: Product[]
): StoreProviderOption[] {
  const byId = new Map<number, StoreProviderOption>();

  for (const p of products) {
    const name = (p.distributor || '').trim();
    if (typeof p.providerId === 'number' && p.providerId > 0 && name) {
      byId.set(p.providerId, {
        id_proveedor: p.providerId,
        ruc_ci: '',
        razon_social: name
      });
    }
  }

  for (const r of remote) {
    const name = (r.razon_social || '').trim();
    if (typeof r.id_proveedor === 'number' && r.id_proveedor > 0 && name) {
      byId.set(r.id_proveedor, {
        id_proveedor: r.id_proveedor,
        ruc_ci: r.ruc_ci || '',
        razon_social: name
      });
    }
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.razon_social.localeCompare(b.razon_social, 'es', { sensitivity: 'base' })
  );
}

/**
 * Loads store distributors/suppliers from /api/proveedores when a product form opens,
 * falling back cleanly to providers referenced in loaded products when offline/unmocked.
 */
export function useStoreProviders(isOpen: boolean, products: Product[]) {
  const [providers, setProviders] = useState<StoreProviderOption[]>(() =>
    mergeProviderOptions([], products)
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setProviders(prev => mergeProviderOptions(prev, products));
    setIsLoading(true);

    api
      .getProveedores()
      .then(remote => {
        if (!active || !Array.isArray(remote)) return;
        setProviders(mergeProviderOptions(remote, products));
      })
      .catch(() => {
        /* keep fallback providers when offline/unmocked */
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, products]);

  const addLocalProvider = useCallback(
    (created: StoreProviderOption) => {
      setProviders(prev => mergeProviderOptions([...prev, created], products));
    },
    [products]
  );

  return { providers, isLoading, addLocalProvider };
}
