import React, { useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Search,
  DollarSign,
  ShoppingCart,
  CheckCircle2,
  Trash2,
  Edit2,
  X,
  Phone,
  Clock,
  Wallet,
  PackagePlus,
  PlusCircle,
  AlertCircle
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { DebtorAccount, DebtorType, Product } from '../../types';
import { parseDecimalInput } from '../../utils/currency';

interface DraftDebtItem {
  key: string;
  productId?: number | null;
  productName: string;
  quantity: number;
  unitPrice: number;
}

type ModalMode =
  | null
  | { kind: 'create'; debtType: DebtorType }
  | { kind: 'edit'; debtor: DebtorAccount }
  | { kind: 'add_more'; debtor: DebtorAccount; addType: DebtorType };

function formatShortDate(raw?: string): string {
  if (!raw) return '';
  return raw.slice(0, 16).replace('T', ' ');
}

export const DebtorsScreen: React.FC = () => {
  const {
    debtors,
    products,
    cashShift,
    createDebtor,
    addToDebtor,
    addDebtorPayment,
    updateDebtor,
    deleteDebtor
  } = useStore();

  const [filterStatus, setFilterStatus] = useState<'PENDIENTE' | 'PAGADO' | 'ALL'>('PENDIENTE');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalMode>(null);
  const [paymentTarget, setPaymentTarget] = useState<DebtorAccount | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Create / Edit / Add-More form state
  const [formType, setFormType] = useState<DebtorType>('MONTO');
  const [personName, setPersonName] = useState('');
  const [phone, setPhone] = useState('');
  const [moneyAmount, setMoneyAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [deductStock, setDeductStock] = useState(false);
  const [draftItems, setDraftItems] = useState<DraftDebtItem[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [customItemName, setCustomItemName] = useState('');
  const [customItemQty, setCustomItemQty] = useState('1');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Payment modal state
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'EFECTIVO' | 'TRANSFERENCIA'>('EFECTIVO');
  const [payNote, setPayNote] = useState('');
  const [payRecordInCash, setPayRecordInCash] = useState(true);
  const [payError, setPayError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  const stats = useMemo(() => {
    const pending = debtors.filter(d => d.status === 'PENDIENTE');
    const paid = debtors.filter(d => d.status === 'PAGADO');
    const totalPending = Number(
      pending.reduce((sum, d) => sum + d.balanceDue, 0).toFixed(2)
    );
    const totalCollected = Number(
      debtors.reduce((sum, d) => sum + d.totalPaid, 0).toFixed(2)
    );
    return {
      pendingCount: pending.length,
      paidCount: paid.length,
      totalCount: debtors.length,
      totalPending,
      totalCollected
    };
  }, [debtors]);

  const filteredDebtors = useMemo(() => {
    const q = search.trim().toLowerCase();
    return debtors.filter(d => {
      if (filterStatus !== 'ALL' && d.status !== filterStatus) return false;
      if (!q) return true;
      return (
        d.personName.toLowerCase().includes(q) ||
        (d.phone && d.phone.toLowerCase().includes(q)) ||
        (d.notes && d.notes.toLowerCase().includes(q)) ||
        d.items.some(it => it.productName.toLowerCase().includes(q))
      );
    });
  }, [debtors, filterStatus, search]);

  const matchingCatalogProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [products, productQuery]);

  const draftItemsTotal = useMemo(() => {
    return Number(
      draftItems.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0).toFixed(2)
    );
  }, [draftItems]);

  const hasCatalogItemInDraft = useMemo(
    () => draftItems.some(it => typeof it.productId === 'number' && it.productId > 0),
    [draftItems]
  );

  const resetForm = () => {
    setPersonName('');
    setPhone('');
    setMoneyAmount('');
    setNotes('');
    setDeductStock(false);
    setDraftItems([]);
    setProductQuery('');
    setCustomItemName('');
    setCustomItemQty('1');
    setCustomItemPrice('');
    setFormError(null);
  };

  const openCreateModal = (debtType: DebtorType) => {
    resetForm();
    setFormType(debtType);
    setModal({ kind: 'create', debtType });
  };

  const openEditModal = (debtor: DebtorAccount) => {
    resetForm();
    setFormType(debtor.debtType);
    setPersonName(debtor.personName);
    setPhone(debtor.phone || '');
    setNotes(debtor.notes || '');
    setMoneyAmount(debtor.totalDebt.toFixed(2));
    setDraftItems(
      debtor.items.map((it, idx) => ({
        key: `${it.id}-${idx}`,
        productId: it.productId ?? null,
        productName: it.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice
      }))
    );
    setModal({ kind: 'edit', debtor });
  };

  const openAddMoreModal = (debtor: DebtorAccount, addType: DebtorType = 'MONTO') => {
    resetForm();
    setFormType(addType);
    setPersonName(debtor.personName);
    setModal({ kind: 'add_more', debtor, addType });
  };

  const openPaymentModal = (debtor: DebtorAccount) => {
    setPaymentTarget(debtor);
    setPayAmount(debtor.balanceDue.toFixed(2));
    setPayMethod('EFECTIVO');
    setPayNote('');
    setPayRecordInCash(Boolean(cashShift.isOpen));
    setPayError(null);
  };

  const addCatalogProductToDraft = (prod: Product) => {
    const numericId = parseInt(prod.id, 10);
    const productId = Number.isFinite(numericId) ? numericId : null;
    setDraftItems(prev => {
      const existingIdx = prev.findIndex(
        it =>
          (productId !== null && it.productId === productId) ||
          it.productName.toLowerCase() === prod.name.toLowerCase()
      );
      if (existingIdx >= 0) {
        return prev.map((it, idx) =>
          idx === existingIdx ? { ...it, quantity: Number((it.quantity + 1).toFixed(3)) } : it
        );
      }
      return [
        ...prev,
        {
          key: `cat-${prod.id}-${Date.now()}`,
          productId,
          productName: prod.name,
          quantity: 1,
          unitPrice: prod.salePrice
        }
      ];
    });
    setProductQuery('');
    setFormError(null);
  };

  const addCustomItemToDraft = () => {
    const cleanName = customItemName.trim();
    const qty = parseDecimalInput(customItemQty);
    const price = parseDecimalInput(customItemPrice);
    if (!cleanName) {
      setFormError('Escribe el nombre del producto manual.');
      return;
    }
    if (qty <= 0) {
      setFormError('La cantidad debe ser mayor a 0.');
      return;
    }
    if (price < 0) {
      setFormError('El precio no puede ser negativo.');
      return;
    }
    setDraftItems(prev => [
      ...prev,
      {
        key: `custom-${Date.now()}-${Math.random()}`,
        productId: null,
        productName: cleanName,
        quantity: qty,
        unitPrice: price
      }
    ]);
    setCustomItemName('');
    setCustomItemQty('1');
    setCustomItemPrice('');
    setFormError(null);
  };

  const updateDraftItem = (key: string, field: 'quantity' | 'unitPrice', raw: string) => {
    const val = parseDecimalInput(raw);
    setDraftItems(prev =>
      prev.map(it => (it.key === key ? { ...it, [field]: Math.max(0, val) } : it))
    );
  };

  const removeDraftItem = (key: string) => {
    setDraftItems(prev => prev.filter(it => it.key !== key));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal || isSaving) return;

    const cleanName = personName.trim();
    if (modal.kind !== 'add_more' && !cleanName) {
      setFormError('Escribe el nombre de la persona.');
      return;
    }

    const validItems = draftItems.filter(it => it.productName.trim() && it.quantity > 0);
    const parsedMoney = parseDecimalInput(moneyAmount);

    if (formType === 'MONTO') {
      if (parsedMoney <= 0) {
        setFormError('Ingresa una cantidad de dinero mayor a $0.00.');
        return;
      }
    } else {
      if (validItems.length === 0) {
        setFormError('Agrega al menos un producto a la lista.');
        return;
      }
      if (draftItemsTotal <= 0) {
        setFormError('El total a pagar debe ser mayor a $0.00.');
        return;
      }
    }

    setFormError(null);
    setIsSaving(true);
    try {
      if (modal.kind === 'create') {
        await createDebtor({
          personName: cleanName,
          phone: phone.trim() || undefined,
          debtType: formType,
          amount: formType === 'MONTO' ? parsedMoney : undefined,
          items:
            formType === 'PRODUCTOS'
              ? validItems.map(it => ({
                  productId: it.productId ?? null,
                  productName: it.productName,
                  quantity: it.quantity,
                  unitPrice: it.unitPrice
                }))
              : [],
          notes: notes.trim() || undefined,
          deductStock: formType === 'PRODUCTOS' ? deductStock : false
        });
      } else if (modal.kind === 'add_more') {
        await addToDebtor(modal.debtor.id, {
          extraAmount: formType === 'MONTO' ? parsedMoney : undefined,
          items:
            formType === 'PRODUCTOS'
              ? validItems.map(it => ({
                  productId: it.productId ?? null,
                  productName: it.productName,
                  quantity: it.quantity,
                  unitPrice: it.unitPrice
                }))
              : [],
          note: notes.trim() || undefined,
          deductStock: formType === 'PRODUCTOS' ? deductStock : false
        });
      } else if (modal.kind === 'edit') {
        await updateDebtor(modal.debtor.id, {
          personName: cleanName,
          phone: phone.trim(),
          notes: notes.trim(),
          amount: formType === 'MONTO' ? parsedMoney : undefined,
          items:
            formType === 'PRODUCTOS'
              ? validItems.map(it => ({
                  productId: it.productId ?? null,
                  productName: it.productName,
                  quantity: it.quantity,
                  unitPrice: it.unitPrice
                }))
              : undefined
        });
      }
      setModal(null);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el registro.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTarget || isPaying) return;

    const amount = parseDecimalInput(payAmount);
    if (amount <= 0) {
      setPayError('El monto del pago debe ser mayor a $0.00.');
      return;
    }
    if (amount > paymentTarget.balanceDue + 0.01) {
      setPayError(`El abono no puede superar el saldo pendiente ($${paymentTarget.balanceDue.toFixed(2)}).`);
      return;
    }

    setPayError(null);
    setIsPaying(true);
    try {
      await addDebtorPayment(paymentTarget.id, {
        amount,
        paymentMethod: payMethod,
        note: payNote.trim() || undefined,
        recordInCash: cashShift.isOpen && payRecordInCash
      });
      setPaymentTarget(null);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'No se pudo registrar el pago.');
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[var(--ui-bg)]">
      {/* Header + Primary Actions */}
      <div className="px-4 sm:px-6 py-4 bg-[var(--ui-surface)] border-b border-[var(--ui-border)] flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base sm:text-lg text-[var(--ui-text)] leading-tight truncate">
              Deudores y Fiados
            </h1>
            <p className="text-xs text-[var(--ui-muted)] truncate">
              Registra deudas por monto o detalladas con productos y controla pagos parciales o totales
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openCreateModal('MONTO')}
            className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <DollarSign className="w-4 h-4 shrink-0" />
            <span>Deudor Solo Monto</span>
          </button>
          <button
            type="button"
            onClick={() => openCreateModal('PRODUCTOS')}
            className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-[var(--ui-chrome)] hover:opacity-90 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm transition-opacity cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4 shrink-0" />
            <span>Deudor con Productos</span>
          </button>
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-[var(--ui-surface)] border border-amber-500/35 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
                Total por Cobrar
              </p>
              <p className="font-mono font-black text-2xl text-amber-600 dark:text-amber-400 mt-0.5">
                ${stats.totalPending.toFixed(2)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
                Deudores Pendientes
              </p>
              <p className="font-mono font-black text-2xl text-[var(--ui-text)] mt-0.5">
                {stats.pendingCount}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[var(--ui-brand-soft)] text-[var(--ui-brand-strong)] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
                Total Cobrado
              </p>
              <p className="font-mono font-black text-2xl text-emerald-600 dark:text-emerald-400 mt-0.5">
                ${stats.totalCollected.toFixed(2)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <div className="flex bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl p-1 gap-1 shrink-0">
            {(
              [
                { key: 'PENDIENTE', label: `Pendientes (${stats.pendingCount})` },
                { key: 'PAGADO', label: `Pagados (${stats.paidCount})` },
                { key: 'ALL', label: `Todos (${stats.totalCount})` }
              ] as const
            ).map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterStatus(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  filterStatus === tab.key
                    ? 'bg-[var(--ui-brand)] text-white shadow-xs'
                    : 'text-[var(--ui-secondary)] hover:text-[var(--ui-text)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 sm:max-w-sm">
            <Search className="w-4 h-4 text-[var(--ui-muted)] absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, producto o teléfono..."
              className="w-full pl-9 pr-8 py-2 bg-[var(--ui-surface)] border border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded-xl text-xs sm:text-sm text-[var(--ui-text)] outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-[var(--ui-muted)] hover:text-[var(--ui-text)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Debtors List */}
        {filteredDebtors.length === 0 ? (
          <div className="bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-2xl p-8 sm:p-10 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[var(--ui-surface-muted)] flex items-center justify-center text-[var(--ui-muted)]">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-sm sm:text-base text-[var(--ui-text)]">
                {search.trim()
                  ? 'No se encontraron deudores con esa búsqueda'
                  : filterStatus === 'PENDIENTE'
                  ? 'No hay deudas pendientes'
                  : 'Todavía no hay registros en esta lista'}
              </p>
              <p className="text-xs text-[var(--ui-muted)] mt-1">
                Registra un deudor colocando solo su nombre y monto, o detallando los productos que debe.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => openCreateModal('MONTO')}
                className="px-3.5 py-2 rounded-xl bg-[var(--ui-brand)] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Registrar Solo Monto</span>
              </button>
              <button
                type="button"
                onClick={() => openCreateModal('PRODUCTOS')}
                className="px-3.5 py-2 rounded-xl bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] text-[var(--ui-text)] text-xs font-bold inline-flex items-center gap-1.5 hover:border-[var(--ui-brand)] cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Registrar con Productos</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
            {filteredDebtors.map(debtor => {
              const isPaid = debtor.status === 'PAGADO';
              return (
                <div
                  key={debtor.id}
                  className={`bg-[var(--ui-surface)] border rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-xs ${
                    isPaid ? 'border-emerald-500/30 opacity-90' : 'border-[var(--ui-border)]'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm sm:text-base text-[var(--ui-text)] truncate">
                            {debtor.personName}
                          </h3>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isPaid
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {isPaid ? '✓ Pagado' : 'Pendiente'}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] text-[var(--ui-secondary)]">
                            {debtor.debtType === 'PRODUCTOS'
                              ? `🛒 Con Productos (${debtor.items.length})`
                              : '💵 Solo Monto'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-[var(--ui-muted)] flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatShortDate(debtor.updatedAt)}</span>
                          </span>
                          {debtor.phone && (
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Phone className="w-3 h-3" />
                              <span>{debtor.phone}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-[10px] font-semibold uppercase text-[var(--ui-muted)]">
                          {isPaid ? 'Total Pagado' : 'Debe'}
                        </div>
                        <div
                          className={`font-mono font-black text-xl leading-tight ${
                            isPaid
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          ${(isPaid ? debtor.totalDebt : debtor.balanceDue).toFixed(2)}
                        </div>
                        {debtor.totalPaid > 0 && !isPaid && (
                          <div className="text-[10px] font-mono text-[var(--ui-muted)]">
                            Total ${debtor.totalDebt.toFixed(2)} · Abonó ${debtor.totalPaid.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Product Items Breakdown (Option 2) */}
                    {debtor.items.length > 0 && (
                      <div className="rounded-xl bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] overflow-hidden">
                        <div className="px-3 py-1.5 border-b border-[var(--ui-border)] flex items-center justify-between text-[11px] font-bold text-[var(--ui-secondary)]">
                          <span>Productos adeudados</span>
                          <span className="font-mono">Total: ${debtor.totalDebt.toFixed(2)}</span>
                        </div>
                        <div className="divide-y divide-[var(--ui-border)]/70 max-h-44 overflow-y-auto">
                          {debtor.items.map(it => (
                            <div
                              key={it.id}
                              className="px-3 py-1.5 text-xs flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0 truncate text-[var(--ui-text)]">
                                <span className="font-mono font-bold text-[var(--ui-brand-strong)] mr-1.5">
                                  {it.quantity}×
                                </span>
                                <span>{it.productName}</span>
                              </div>
                              <div className="font-mono text-right shrink-0 text-[var(--ui-secondary)]">
                                <span className="text-[10px] text-[var(--ui-muted)] mr-1.5">
                                  (${it.unitPrice.toFixed(2)})
                                </span>
                                <strong className="text-[var(--ui-text)]">${it.subtotal.toFixed(2)}</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {debtor.notes && (
                      <div className="text-xs text-[var(--ui-secondary)] bg-[var(--ui-surface-muted)]/70 px-3 py-2 rounded-lg border border-[var(--ui-border)]/70">
                        <span className="font-semibold text-[var(--ui-muted)]">Nota: </span>
                        {debtor.notes}
                      </div>
                    )}

                    {/* Payment History */}
                    {debtor.payments.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--ui-muted)]">
                          Historial de pagos ({debtor.payments.length})
                        </div>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {debtor.payments.map(ab => (
                            <div
                              key={ab.id}
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/8 border border-emerald-500/20 flex items-center justify-between gap-2"
                            >
                              <span className="text-[var(--ui-secondary)] truncate">
                                {formatShortDate(ab.dateTime)} · {ab.paymentMethod}
                                {ab.note ? ` · ${ab.note}` : ''}
                                {ab.recordedInCash ? ' · En caja' : ''}
                              </span>
                              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                                +${ab.amount.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="pt-2.5 border-t border-[var(--ui-border)] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {!isPaid && (
                        <button
                          type="button"
                          onClick={() => openPaymentModal(debtor)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Abonar / Pagar</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          openAddMoreModal(
                            debtor,
                            debtor.debtType === 'PRODUCTOS' ? 'PRODUCTOS' : 'MONTO'
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-[var(--ui-brand-soft)] hover:bg-[var(--ui-brand)]/20 text-[var(--ui-brand-strong)] text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Sumar más</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(debtor)}
                        title="Editar deudor"
                        className="p-1.5 rounded-lg border border-[var(--ui-border)] text-[var(--ui-secondary)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-surface-hover)] cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {confirmDeleteId === debtor.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteDebtor(debtor.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold cursor-pointer"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 rounded-lg border border-[var(--ui-border)] text-[11px] font-semibold text-[var(--ui-secondary)] cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(debtor.id)}
                          title="Eliminar registro"
                          aria-label={`Eliminar deudor ${debtor.personName}`}
                          className="p-1.5 rounded-lg border border-[var(--ui-border)] text-[var(--ui-muted)] hover:text-[var(--ui-danger-text)] hover:bg-[var(--ui-danger-bg)] hover:border-[var(--ui-danger-border)] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit / Add-More Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-3 sm:p-5"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[var(--ui-chrome)] text-white px-5 py-3.5 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {formType === 'PRODUCTOS' ? (
                  <ShoppingCart className="w-4 h-4 text-[var(--ui-mint)] shrink-0" />
                ) : (
                  <DollarSign className="w-4 h-4 text-[var(--ui-mint)] shrink-0" />
                )}
                <h2 className="font-bold text-sm sm:text-base truncate">
                  {modal.kind === 'create'
                    ? formType === 'PRODUCTOS'
                      ? 'Nuevo Deudor — Con Productos'
                      : 'Nuevo Deudor — Solo Monto'
                    : modal.kind === 'add_more'
                    ? `Sumar a deuda de ${modal.debtor.personName}`
                    : `Editar Deudor: ${modal.debtor.personName}`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Mode Switcher (Create & Add More) */}
              {modal.kind !== 'edit' && (
                <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setFormType('MONTO');
                      setFormError(null);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      formType === 'MONTO'
                        ? 'bg-[var(--ui-brand)] text-white shadow-xs'
                        : 'text-[var(--ui-secondary)] hover:text-[var(--ui-text)]'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Solo Nombre y Monto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormType('PRODUCTOS');
                      setFormError(null);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      formType === 'PRODUCTOS'
                        ? 'bg-[var(--ui-brand)] text-white shadow-xs'
                        : 'text-[var(--ui-secondary)] hover:text-[var(--ui-text)]'
                    }`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Con Productos y Total</span>
                  </button>
                </div>
              )}

              {formError && (
                <div className="p-2.5 rounded-xl bg-[var(--ui-danger-bg)] border border-[var(--ui-danger-border)] text-[var(--ui-danger-text)] text-xs font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Person Name & Phone */}
              {modal.kind !== 'add_more' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="debtor-name-input"
                      className="block text-xs font-bold text-[var(--ui-secondary)] mb-1"
                    >
                      Nombre de la persona *
                    </label>
                    <input
                      id="debtor-name-input"
                      type="text"
                      required
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      placeholder="Ej: María López, Don Carlos..."
                      className="w-full px-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded-xl text-sm font-semibold text-[var(--ui-text)] outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="debtor-phone-input"
                      className="block text-xs font-bold text-[var(--ui-secondary)] mb-1"
                    >
                      Teléfono (opc.)
                    </label>
                    <input
                      id="debtor-phone-input"
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="099..."
                      className="w-full px-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded-xl text-sm text-[var(--ui-text)] outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Option 1: Solo Monto */}
              {formType === 'MONTO' ? (
                <div>
                  <label
                    htmlFor="debtor-amount-input"
                    className="block text-xs font-bold text-[var(--ui-brand-strong)] mb-1"
                  >
                    {modal.kind === 'add_more'
                      ? 'Cantidad adicional a sumar ($) *'
                      : 'Cantidad de dinero que debe ($) *'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 font-mono font-black text-base text-[var(--ui-brand-strong)]">
                      $
                    </span>
                    <input
                      id="debtor-amount-input"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={moneyAmount}
                      onChange={(e) => setMoneyAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-2.5 bg-[var(--ui-surface)] border-2 border-[var(--ui-brand)] rounded-xl font-mono font-black text-lg text-[var(--ui-brand-strong)] outline-none"
                    />
                  </div>
                </div>
              ) : (
                /* Option 2: Con Productos + Total a Pagar */
                <div className="space-y-3">
                  {/* Quick Catalog Search */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[var(--ui-secondary)]">
                      Buscar producto de tu inventario (agrega con PVP automático)
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-[var(--ui-muted)] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={productQuery}
                        onChange={(e) => setProductQuery(e.target.value)}
                        placeholder="Escribe nombre o código (ej: huevo, cola, arroz)..."
                        className="w-full pl-9 pr-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded-xl text-xs sm:text-sm text-[var(--ui-text)] outline-none"
                      />
                    </div>
                    {matchingCatalogProducts.length > 0 && (
                      <div className="rounded-xl border border-[var(--ui-border-strong)] bg-[var(--ui-surface)] divide-y divide-[var(--ui-border)] max-h-44 overflow-y-auto shadow-md">
                        {matchingCatalogProducts.map(prod => (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => addCatalogProductToDraft(prod)}
                            className="w-full px-3 py-2 text-left hover:bg-[var(--ui-brand-soft)] flex items-center justify-between gap-2 text-xs cursor-pointer"
                          >
                            <div className="min-w-0 truncate">
                              <span className="font-bold text-[var(--ui-text)]">{prod.name}</span>
                              <span className="ml-2 text-[10px] font-mono text-[var(--ui-muted)]">
                                Stock: {prod.stock}
                              </span>
                            </div>
                            <span className="font-mono font-bold text-[var(--ui-brand-strong)] shrink-0">
                              +${prod.salePrice.toFixed(2)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Manual Custom Product Entry */}
                  <div className="p-3 rounded-xl bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] space-y-2">
                    <div className="text-[11px] font-bold text-[var(--ui-secondary)] flex items-center gap-1">
                      <PackagePlus className="w-3.5 h-3.5 text-[var(--ui-brand-strong)]" />
                      <span>O agrega un producto manualmente</span>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <input
                        type="text"
                        aria-label="Producto manual"
                        value={customItemName}
                        onChange={(e) => setCustomItemName(e.target.value)}
                        placeholder="Producto (ej: Pan, Cola...)"
                        className="col-span-6 px-2.5 py-1.5 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg text-xs text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                      />
                      <input
                        type="number"
                        aria-label="Cantidad manual"
                        step="0.01"
                        min="0.01"
                        value={customItemQty}
                        onChange={(e) => setCustomItemQty(e.target.value)}
                        placeholder="Cant."
                        className="col-span-2 px-2 py-1.5 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg font-mono text-xs text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                      />
                      <input
                        type="number"
                        aria-label="Precio unitario manual"
                        step="0.01"
                        min="0"
                        value={customItemPrice}
                        onChange={(e) => setCustomItemPrice(e.target.value)}
                        placeholder="$ c/u"
                        className="col-span-2 px-2 py-1.5 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg font-mono text-xs text-[var(--ui-text)] outline-none focus:border-[var(--ui-brand)]"
                      />
                      <button
                        type="button"
                        onClick={addCustomItemToDraft}
                        className="col-span-2 py-1.5 px-2 rounded-lg bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Añadir</span>
                      </button>
                    </div>
                  </div>

                  {/* Added Products List + Total a Pagar */}
                  <div className="rounded-xl border border-[var(--ui-border)] overflow-hidden">
                    <div className="px-3 py-2 bg-[var(--ui-surface-muted)] border-b border-[var(--ui-border)] flex items-center justify-between text-xs font-bold text-[var(--ui-secondary)]">
                      <span>Productos en la deuda ({draftItems.length})</span>
                      <span>Total a pagar</span>
                    </div>
                    {draftItems.length === 0 ? (
                      <div className="p-4 text-center text-xs text-[var(--ui-muted)]">
                        Busca arriba un producto de tu inventario o añádelo manualmente.
                      </div>
                    ) : (
                      <div className="divide-y divide-[var(--ui-border)] max-h-48 overflow-y-auto">
                        {draftItems.map(it => {
                          const sub = Number((it.quantity * it.unitPrice).toFixed(2));
                          return (
                            <div
                              key={it.key}
                              className="px-3 py-2 flex items-center gap-2 text-xs bg-[var(--ui-surface)]"
                            >
                              <div className="flex-1 min-w-0 font-semibold text-[var(--ui-text)] truncate">
                                {it.productName}
                              </div>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                aria-label={`Cantidad de ${it.productName}`}
                                value={it.quantity}
                                onChange={(e) => updateDraftItem(it.key, 'quantity', e.target.value)}
                                className="w-16 px-2 py-1 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg font-mono text-xs text-center outline-none"
                              />
                              <span className="text-[var(--ui-muted)]">×</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                aria-label={`Precio de ${it.productName}`}
                                value={it.unitPrice}
                                onChange={(e) => updateDraftItem(it.key, 'unitPrice', e.target.value)}
                                className="w-20 px-2 py-1 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-lg font-mono text-xs text-right outline-none"
                              />
                              <span className="w-16 text-right font-mono font-bold text-[var(--ui-brand-strong)] shrink-0">
                                ${sub.toFixed(2)}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeDraftItem(it.key)}
                                aria-label={`Quitar ${it.productName}`}
                                className="p-1 text-[var(--ui-muted)] hover:text-[var(--ui-danger-text)] cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="px-3.5 py-2.5 bg-[var(--ui-brand-soft)] border-t border-[var(--ui-border)] flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--ui-brand-strong)]">
                        TOTAL A PAGAR
                      </span>
                      <span className="font-mono font-black text-lg text-[var(--ui-brand-strong)]">
                        ${draftItemsTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Optional Stock Deduction Toggle */}
                  {modal.kind !== 'edit' && hasCatalogItemInDraft && (
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--ui-text)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deductStock}
                        onChange={(e) => setDeductStock(e.target.checked)}
                        className="w-4 h-4 rounded accent-[var(--ui-brand)]"
                      />
                      <span>Descontar estos productos del stock de inventario</span>
                    </label>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-[var(--ui-secondary)] mb-1">
                  Nota / Detalle (opcional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Quedó en pagar el viernes..."
                  className="w-full px-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] focus:border-[var(--ui-brand)] rounded-xl text-xs sm:text-sm text-[var(--ui-text)] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--ui-border)]">
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="px-4 py-2 rounded-xl border border-[var(--ui-border)] text-xs font-bold text-[var(--ui-secondary)] hover:bg-[var(--ui-surface-hover)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-[var(--ui-brand)] hover:bg-[var(--ui-brand-hover)] disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isSaving
                      ? 'Guardando...'
                      : modal.kind === 'add_more'
                      ? 'Sumar a Deuda'
                      : modal.kind === 'edit'
                      ? 'Guardar Cambios'
                      : 'Guardar Deudor'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment / Abono Modal */}
      {paymentTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
          onClick={() => setPaymentTarget(null)}
        >
          <div
            className="bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-emerald-600 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm sm:text-base">
                  Registrar Pago / Abono
                </h3>
                <p className="text-[11px] text-white/85">
                  {paymentTarget.personName} · Saldo pendiente: ${paymentTarget.balanceDue.toFixed(2)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentTarget(null)}
                className="p-1 rounded-lg hover:bg-white/15 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-5 space-y-4">
              {payError && (
                <div className="p-2.5 rounded-xl bg-[var(--ui-danger-bg)] border border-[var(--ui-danger-border)] text-[var(--ui-danger-text)] text-xs font-semibold">
                  {payError}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="debtor-pay-amount"
                    className="text-xs font-bold text-[var(--ui-secondary)]"
                  >
                    Monto que paga ($) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setPayAmount(paymentTarget.balanceDue.toFixed(2))}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Pagar todo (${paymentTarget.balanceDue.toFixed(2)})
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 font-mono font-black text-base text-emerald-600 dark:text-emerald-400">
                    $
                  </span>
                  <input
                    id="debtor-pay-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-[var(--ui-surface)] border-2 border-emerald-500 rounded-xl font-mono font-black text-lg text-emerald-600 dark:text-emerald-400 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--ui-secondary)] mb-1">
                  Forma de pago
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['EFECTIVO', 'TRANSFERENCIA'] as const).map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => {
                        setPayMethod(method);
                        setPayRecordInCash(method === 'EFECTIVO' && cashShift.isOpen);
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                        payMethod === method
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-[var(--ui-surface-muted)] text-[var(--ui-secondary)] border-[var(--ui-border)]'
                      }`}
                    >
                      {method === 'EFECTIVO' ? '💵 Efectivo' : '🏦 Transferencia'}
                    </button>
                  ))}
                </div>
              </div>

              {cashShift.isOpen && (
                <label className="flex items-start gap-2 text-xs text-[var(--ui-text)] bg-[var(--ui-surface-muted)] p-3 rounded-xl border border-[var(--ui-border)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={payRecordInCash}
                    onChange={(e) => setPayRecordInCash(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded accent-emerald-600"
                  />
                  <span>
                    <strong>Sumar ingreso a la caja actual</strong>
                    <span className="block text-[11px] text-[var(--ui-muted)]">
                      Registra el cobro en tu turno abierto para que el cuadre de caja sea exacto.
                    </span>
                  </span>
                </label>
              )}

              <div>
                <label className="block text-xs font-bold text-[var(--ui-secondary)] mb-1">
                  Nota (opcional)
                </label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Ej: Abono parcial..."
                  className="w-full px-3 py-2 bg-[var(--ui-surface-muted)] border border-[var(--ui-border)] rounded-xl text-xs text-[var(--ui-text)] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--ui-border)]">
                <button
                  type="button"
                  onClick={() => setPaymentTarget(null)}
                  className="px-4 py-2 rounded-xl border border-[var(--ui-border)] text-xs font-bold text-[var(--ui-secondary)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPaying}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isPaying ? 'Registrando...' : 'Confirmar Pago'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
