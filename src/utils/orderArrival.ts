import { Product, PurchaseOrder, ReceptionDraftItem } from '../types';

export type OrderArrivalState = 'pending' | 'arrived' | 'missing';

/** Cycles an item's physical arrival status: 1 tap -> green (arrived), 2 taps -> red (missing), 3 taps -> pending. */
export function cycleOrderArrivalState(current?: OrderArrivalState): OrderArrivalState {
  if (current === 'arrived') return 'missing';
  if (current === 'missing') return 'pending';
  return 'arrived';
}

export function countOrderArrivalStates(
  itemIds: string[],
  states: Record<string, OrderArrivalState>
): { arrivedCount: number; missingCount: number; pendingCount: number } {
  let arrivedCount = 0;
  let missingCount = 0;
  let pendingCount = 0;

  for (const id of itemIds) {
    const state = states[id] || 'pending';
    if (state === 'arrived') arrivedCount += 1;
    else if (state === 'missing') missingCount += 1;
    else pendingCount += 1;
  }

  return { arrivedCount, missingCount, pendingCount };
}

export function buildReceptionItemsFromOrder(
  order: PurchaseOrder,
  products: Product[],
  onlyArrivedStates?: Record<string, OrderArrivalState>
): ReceptionDraftItem[] {
  return order.items
    .filter((it, idx) => {
      if (!onlyArrivedStates) return true;
      const key = it.id || it.productId || String(idx);
      return onlyArrivedStates[key] === 'arrived';
    })
    .map((it) => {
      const catalogProduct = products.find(
        (prod) => prod.id === it.productId || prod.code === it.code
      );
      const fallbackSalePrice = Number((it.estimatedCost * 1.3).toFixed(2));
      return {
        id: `rec-ord-${it.id || it.productId}`,
        code: it.code,
        name: it.name,
        quantityReceived: it.quantityOrdered,
        unitCost: it.estimatedCost,
        previousCost: catalogProduct ? catalogProduct.costPrice : it.estimatedCost,
        salePrice: catalogProduct ? catalogProduct.salePrice : fallbackSalePrice,
        suggestedSalePrice: catalogProduct ? catalogProduct.salePrice : fallbackSalePrice
      };
    });
}
