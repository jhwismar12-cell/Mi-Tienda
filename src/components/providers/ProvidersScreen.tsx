import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Barcode,
  Building2,
  CheckCircle2,
  Edit2,
  Package,
  Phone,
  Plus,
  Search,
  Trash2,
  X
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { ApiError, api } from '../../services/api';
import { Product } from '../../types';
import { StoreProviderOption, useStoreProviders } from '../../utils/providers';

export const ProvidersScreen: React.FC = () => {
  const { products, deleteProduct, renameProviderInProducts, showToast } = useStore();
  const { providers, addLocalProvider, updateLocalProvider } = useStoreProviders(true, products);

  const [searchQuery, setSearchQuery] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);

  // Create / Edit distributor modal state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingProvider, setEditingProvider] = useState<StoreProviderOption | null>(null);
  const [formName, setFormName] = useState('');
  const [formRuc, setFormRuc] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [isSavingProvider, setIsSavingProvider] = useState(false);

  // Confirm permanent / root product deletion modal
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);

  const productsByProviderId = useMemo(() => {
    const map = new Map<number, Product[]>();
    const idByLowerName = new Map<string, number>();

    for (const prov of providers) {
      map.set(prov.id_proveedor, []);
      idByLowerName.set(prov.razon_social.trim().toLowerCase(), prov.id_proveedor);
    }

    for (const prod of products) {
      let targetId: number | undefined;
      if (typeof prod.providerId === 'number' && map.has(prod.providerId)) {
        targetId = prod.providerId;
      } else {
        const lowerDist = (prod.distributor || '').trim().toLowerCase();
        if (lowerDist && idByLowerName.has(lowerDist)) {
          targetId = idByLowerName.get(lowerDist);
        }
      }
      if (targetId !== undefined) {
        map.get(targetId)!.push(prod);
      }
    }

    return map;
  }, [providers, products]);

  const filteredProviders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter((prov) => {
      if (
        prov.razon_social.toLowerCase().includes(q) ||
        (prov.ruc_ci || '').toLowerCase().includes(q) ||
        (prov.telefono || '').toLowerCase().includes(q)
      ) {
        return true;
      }
      const items = productsByProviderId.get(prov.id_proveedor) || [];
      return items.some(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.barcode || '').toLowerCase().includes(q)
      );
    });
  }, [providers, searchQuery, productsByProviderId]);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id_proveedor === selectedProviderId) || null,
    [providers, selectedProviderId]
  );

  const selectedProviderProducts = useMemo(() => {
    if (!selectedProvider) return [];
    const list = productsByProviderId.get(selectedProvider.id_proveedor) || [];
    const q = productSearch.trim().toLowerCase();
    const filtered = !q
      ? list
      : list.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q) ||
            (p.barcode || '').toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q)
        );
    return [...filtered].sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    );
  }, [selectedProvider, productsByProviderId, productSearch]);

  const openCreateModal = () => {
    setModalMode('create');
    setEditingProvider(null);
    setFormName('');
    setFormRuc('');
    setFormPhone('');
    setFormAddress('');
  };

  const openEditModal = (prov: StoreProviderOption, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setModalMode('edit');
    setEditingProvider(prov);
    setFormName(prov.razon_social);
    setFormRuc(prov.ruc_ci || '');
    setFormPhone(prov.telefono || '');
    setFormAddress(prov.direccion || '');
  };

  const closeProviderModal = () => {
    if (isSavingProvider) return;
    setModalMode(null);
    setEditingProvider(null);
  };

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    if (!cleanName || isSavingProvider) return;

    setIsSavingProvider(true);
    try {
      if (modalMode === 'create') {
        const created = await api.crearProveedor({
          razon_social: cleanName,
          ruc_ci: formRuc.trim() || undefined,
          telefono: formPhone.trim() || undefined,
          direccion: formAddress.trim() || undefined
        });
        addLocalProvider(created);
        setSelectedProviderId(created.id_proveedor);
        showToast(`Distribuidor "${created.razon_social}" creado`);
      } else if (modalMode === 'edit' && editingProvider) {
        const previousName = editingProvider.razon_social;
        const updated = await api.actualizarProveedor(editingProvider.id_proveedor, {
          razon_social: cleanName,
          ruc_ci: formRuc.trim(),
          telefono: formPhone.trim() || undefined,
          direccion: formAddress.trim() || undefined
        });
        updateLocalProvider(updated);
        renameProviderInProducts(updated.id_proveedor, previousName, updated.razon_social);
        showToast(`Distribuidor actualizado a "${updated.razon_social}"`);
      }
      setModalMode(null);
      setEditingProvider(null);
    } catch (err) {
      if (err instanceof ApiError) {
        showToast(`⚠️ ${err.message}`);
      } else {
        showToast('⚠️ No se pudo guardar el distribuidor');
      }
    } finally {
      setIsSavingProvider(false);
    }
  };

  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete || isDeletingProduct) return;
    setIsDeletingProduct(true);
    try {
      await deleteProduct(productToDelete.id);
      setProductToDelete(null);
    } catch {
      // StoreContext already notifies ApiError
    } finally {
      setIsDeletingProduct(false);
    }
  };

  return (
    <div className="workspace-screen flex-1 flex flex-col h-full overflow-hidden bg-[var(--ui-surface)] select-none">
      {/* Page Header */}
      <div className="px-4 lg:px-6 py-4 border-b border-[var(--ui-border)] bg-[var(--ui-surface)] shrink-0 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <p className="workspace-eyebrow mb-1">Proveedores y catálogo</p>
            <h1 className="workspace-heading font-bold text-xl md:text-2xl text-[var(--ui-text)] tracking-tight flex flex-wrap items-center gap-2">
              <span>Gestión de Distribuidores</span>
              <span className="status-pill text-xs bg-[var(--ui-brand)]/10 text-[var(--ui-brand-strong)] px-2.5 py-0.5 rounded-full font-semibold">
                {providers.length} distribuidores
              </span>
            </h1>
            <p className="text-xs md:text-sm text-[var(--ui-muted)] mt-1">
              Edita nombres, consulta sus productos y elimina artículos que ya no se venderán.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="primary-action bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white text-xs md:text-sm font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Distribuidor</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--ui-muted)] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar distribuidor, RUC o producto asociado..."
            className="w-full pl-9 pr-9 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg text-xs md:text-sm text-[var(--ui-text)] placeholder:text-[var(--ui-subtle)] outline-none focus:border-[var(--ui-brand)] focus:bg-[var(--ui-surface)] transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Limpiar búsqueda de distribuidores"
              className="absolute right-2 top-1.5 p-1 text-[var(--ui-subtle)] hover:text-[var(--ui-text)] rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Master-Detail Content */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
        {/* Distributors List (always visible on desktop; hidden on mobile when viewing one distributor) */}
        <div
          className={`${
            selectedProvider ? 'hidden lg:flex' : 'flex'
          } lg:col-span-5 flex-col border-r border-[var(--ui-border)] overflow-y-auto p-4 space-y-2.5 bg-[var(--ui-surface-muted)]/40 min-h-0`}
        >
          {filteredProviders.length === 0 ? (
            <div className="py-12 text-center text-xs md:text-sm text-[var(--ui-subtle)]">
              No se encontraron distribuidores que coincidan con tu búsqueda.
            </div>
          ) : (
            filteredProviders.map((prov) => {
              const prodCount = (productsByProviderId.get(prov.id_proveedor) || []).length;
              const isSelected = selectedProviderId === prov.id_proveedor;

              return (
                <div
                  key={prov.id_proveedor}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedProviderId(prov.id_proveedor);
                    setProductSearch('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedProviderId(prov.id_proveedor);
                      setProductSearch('');
                    }
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-[var(--ui-brand-soft)] border-[var(--ui-brand)] shadow-xs'
                      : 'bg-[var(--ui-surface)] border-[var(--ui-border)] hover:border-[var(--ui-brand)]/40 hover:bg-[var(--ui-surface-hover)]'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[var(--ui-brand-strong)] shrink-0" />
                      <h2 className="font-bold text-sm text-[var(--ui-text)] truncate">
                        {prov.razon_social}
                      </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--ui-muted)]">
                      <span className="font-semibold text-[var(--ui-brand-strong)] bg-[var(--ui-brand)]/10 px-2 py-0.5 rounded-full">
                        {prodCount} {prodCount === 1 ? 'producto' : 'productos'}
                      </span>
                      {prov.ruc_ci && <span className="font-mono">RUC: {prov.ruc_ci}</span>}
                      {prov.telefono && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {prov.telefono}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => openEditModal(prov, e)}
                    aria-label={`Editar distribuidor ${prov.razon_social}`}
                    title="Editar nombre o datos del distribuidor"
                    className="px-2.5 py-1.5 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] hover:bg-[var(--ui-surface-hover)] text-[var(--ui-secondary)] hover:text-[var(--ui-brand-strong)] text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Distributor Detail & Products List */}
        <div
          className={`${
            selectedProvider ? 'flex' : 'hidden lg:flex'
          } lg:col-span-7 flex-col overflow-hidden bg-[var(--ui-surface)] min-h-0`}
        >
          {!selectedProvider ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--ui-subtle)] space-y-2">
              <Building2 className="w-10 h-10 opacity-40" />
              <p className="text-sm font-semibold text-[var(--ui-secondary)]">
                Selecciona un distribuidor
              </p>
              <p className="text-xs max-w-sm">
                Haz clic en cualquier distribuidor de la lista para editar su nombre, revisar todos sus productos o eliminar alguno de raíz.
              </p>
            </div>
          ) : (
            <>
              {/* Selected Distributor Header */}
              <div className="p-4 border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)]/60 space-y-3 shrink-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedProviderId(null)}
                      aria-label="Volver a distribuidores"
                      className="lg:hidden p-1.5 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-secondary)] hover:text-[var(--ui-text)] cursor-pointer shrink-0"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="min-w-0">
                      <h2 className="font-bold text-base md:text-lg text-[var(--ui-text)] truncate">
                        {selectedProvider.razon_social}
                      </h2>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ui-muted)] mt-0.5">
                        {selectedProvider.ruc_ci && (
                          <span className="font-mono">RUC/CI: {selectedProvider.ruc_ci}</span>
                        )}
                        {selectedProvider.telefono && <span>Tel: {selectedProvider.telefono}</span>}
                        {selectedProvider.direccion && <span>{selectedProvider.direccion}</span>}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openEditModal(selectedProvider)}
                    className="px-3 py-1.5 rounded-lg bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors shrink-0"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Cambiar Nombre / Editar</span>
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--ui-muted)] pointer-events-none" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder={`Filtrar productos de ${selectedProvider.razon_social}...`}
                    className="w-full pl-8 pr-8 py-1.5 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg text-xs text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                  />
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => setProductSearch('')}
                      className="absolute right-2 top-1.5 p-0.5 text-[var(--ui-subtle)] hover:text-[var(--ui-text)] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Products of Distributor */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-0">
                {selectedProviderProducts.length === 0 ? (
                  <div className="py-10 text-center text-xs md:text-sm text-[var(--ui-subtle)] space-y-1">
                    <Package className="w-8 h-8 mx-auto opacity-40" />
                    <p>
                      {productSearch.trim()
                        ? 'Ningún producto de este distribuidor coincide con tu filtro.'
                        : 'Este distribuidor no tiene productos activos asignados.'}
                    </p>
                  </div>
                ) : (
                  selectedProviderProducts.map((prod) => (
                    <div
                      key={prod.id}
                      className="p-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] hover:bg-[var(--ui-surface-hover)] flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="font-bold text-xs md:text-sm text-[var(--ui-text)] truncate">
                          {prod.name}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--ui-muted)]">
                          <span className="font-mono font-semibold text-[var(--ui-secondary)]">
                            {prod.code}
                          </span>
                          {prod.barcode && (
                            <span className="inline-flex items-center gap-1 font-mono bg-[var(--ui-brand)]/10 text-[var(--ui-brand-strong)] px-1.5 py-0.5 rounded">
                              <Barcode className="w-3 h-3" />
                              {prod.barcode}
                            </span>
                          )}
                          <span>{prod.category}</span>
                          <span className="font-mono">
                            PVP: <strong className="text-[var(--ui-text)]">${prod.salePrice.toFixed(2)}</strong>
                          </span>
                          <span className="font-mono">Stock: {prod.stock}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setProductToDelete(prod)}
                        aria-label={`Eliminar producto ${prod.name}`}
                        title="Eliminar producto de raíz"
                        className="px-2.5 py-1.5 rounded-lg bg-[var(--ui-danger-bg)] hover:bg-[var(--ui-danger-solid)] text-[var(--ui-danger-text)] hover:text-white border border-[var(--ui-danger-border)] text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create / Edit Distributor Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[var(--ui-surface)] rounded-2xl border border-[var(--ui-border)] shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-[var(--ui-chrome)] px-5 py-4 flex items-center justify-between text-white border-b border-[var(--ui-border-strong)]">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[var(--ui-mint)]" />
                <h2 className="font-bold text-base">
                  {modalMode === 'create' ? 'Nuevo Distribuidor' : 'Editar Distribuidor'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeProviderModal}
                aria-label="Cerrar modal distribuidor"
                className="p-1 rounded-lg text-[var(--ui-subtle)] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProvider} className="p-5 space-y-3.5 text-xs md:text-sm">
              <div>
                <label className="block font-bold text-[var(--ui-text)] mb-1">
                  Nombre del Distribuidor <span className="text-[var(--ui-danger-text)]">*</span>
                </label>
                <input
                  type="text"
                  required
                  aria-label="Nombre del distribuidor"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Distribuidora LOBA"
                  className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                    RUC / Cédula
                  </label>
                  <input
                    type="text"
                    aria-label="RUC o Cédula"
                    value={formRuc}
                    onChange={(e) => setFormRuc(e.target.value)}
                    placeholder="Opcional"
                    className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-[var(--ui-text)] font-mono outline-none focus:border-[var(--ui-brand)]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    aria-label="Teléfono del distribuidor"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="Opcional"
                    className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[var(--ui-secondary)] mb-1">
                  Dirección / Contacto
                </label>
                <input
                  type="text"
                  aria-label="Dirección del distribuidor"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Opcional"
                  className="w-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg px-3 py-2 text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--ui-border)]">
                <button
                  type="button"
                  onClick={closeProviderModal}
                  className="px-4 py-2 text-xs font-semibold text-[var(--ui-secondary)] hover:bg-[var(--ui-surface-hover)] rounded-xl border border-[var(--ui-border)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingProvider || !formName.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] disabled:opacity-50 rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-[var(--ui-mint)]" />
                  <span>{isSavingProvider ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Root Deletion Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-[var(--ui-surface)] rounded-2xl border border-[var(--ui-border)] shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 bg-[var(--ui-danger-bg)] border-b border-[var(--ui-danger-border)] flex items-center gap-2.5 text-[var(--ui-danger-text)]">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="font-bold text-base">Eliminar Producto de Raíz</h2>
            </div>

            <div className="p-5 space-y-3 text-xs md:text-sm text-[var(--ui-text)]">
              <p>
                ¿Seguro que deseas eliminar permanentemente{' '}
                <strong>{productToDelete.name}</strong> ({productToDelete.code})?
              </p>
              <p className="text-xs text-[var(--ui-muted)]">
                Esta acción quita el producto del catálogo y libera su código de barras si ya no se va a vender. (Si tiene ventas o compras históricas previas, esos recibos antiguos se conservan sin mostrarlo en el catálogo activo.)
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--ui-border)]">
                <button
                  type="button"
                  onClick={() => setProductToDelete(null)}
                  disabled={isDeletingProduct}
                  className="px-4 py-2 text-xs font-semibold text-[var(--ui-secondary)] hover:bg-[var(--ui-surface-hover)] rounded-xl border border-[var(--ui-border)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteProduct}
                  disabled={isDeletingProduct}
                  className="px-4 py-2 text-xs font-bold text-white bg-[var(--ui-danger-solid)] hover:opacity-90 disabled:opacity-50 rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeletingProduct ? 'Eliminando...' : 'Sí, eliminar de raíz'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
