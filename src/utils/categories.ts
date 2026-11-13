import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Product, STORE_CATEGORIES } from '../types';

/**
 * Loads backend store categories cleanly (supporting custom catalogs like stationery/hardware),
 * falling back to categories present in loaded products and default store categories.
 */
export function useStoreCategories(isOpen: boolean, products: Product[]): string[] {
  const buildFallback = () => {
    const fromProducts = products.map(p => (p.category || '').trim()).filter(Boolean);
    const merged = Array.from(new Set([...fromProducts, ...STORE_CATEGORIES]));
    return merged.length > 0 ? merged : [...STORE_CATEGORIES];
  };

  const [categories, setCategories] = useState<string[]>(buildFallback);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const fallback = buildFallback();
    setCategories(fallback);

    api
      .getCategorias()
      .then(remote => {
        if (!active || !Array.isArray(remote) || remote.length === 0) return;
        const names = remote.map(c => (c.nombre || '').trim()).filter(Boolean);
        if (names.length > 0) {
          setCategories(Array.from(new Set(names)));
        }
      })
      .catch(() => {
        /* keep fallback categories when offline/unmocked */
      });

    return () => {
      active = false;
    };
  }, [isOpen, products]);

  return categories;
}
