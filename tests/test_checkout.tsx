import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { StoreProvider, StoreContextType, useStore } from '../src/context/StoreContext';
import { api, ApiError, BackendCashSession, BackendProduct, BackendSale } from '../src/services/api';
import { Product, ReceptionInvoice } from '../src/types';
import { ReceptionScreen } from '../src/components/inventory/ReceptionScreen';
import { NewProductModal } from '../src/components/modals/NewProductModal';
import { AltaAlVueloModal } from '../src/components/modals/AltaAlVueloModal';
import { BulkSaleModal } from '../src/components/pos/BulkSaleModal';
import {
  formatPromoDescription,
  isBulkEligibleProduct
} from '../src/components/pos/BulkProductCreateForm';
import { SupplierSearchModal } from '../src/components/pos/SupplierSearchModal';
import { PosScreen } from '../src/components/pos/PosScreen';
import { GlobalSearchModal } from '../src/components/modals/GlobalSearchModal';
import { BarcodeCameraModal, createBarcodeReader } from '../src/components/modals/BarcodeCameraModal';
import { InventoryScreen } from '../src/components/inventory/InventoryScreen';
import { Sidebar, MobileBottomNav } from '../src/components/Sidebar';
import { TopHeader } from '../src/components/TopHeader';
import { ProvidersScreen } from '../src/components/providers/ProvidersScreen';
import { LoginScreen } from '../src/components/auth/LoginScreen';
import { canAutoFocusInput } from '../src/utils/responsive';

const product: Product = { id: '1', code: 'INTERNAL', barcode: 'BARCODE', name: 'Producto', category: 'Bebidas', costPrice: 2, salePrice: 3, stock: 10, minStock: 1 };
const shift: BackendCashSession = {
  id_sesion_caja: 1, id_usuario: 1, cajero_nombre: 'Admin', fecha_apertura: '2026-10-13 08:00:00',
  monto_inicial: 20, total_ventas_efectivo: 0, total_ventas_transferencia: 0, total_retiros: 0,
  total_esperado: 20, estado: 'ABIERTA', movimientos: []
};
const sale: BackendSale = {
  id_venta: 1, id_sesion_caja: 1, id_usuario: 1, cajero_nombre: 'Admin', numero_venta: 'TK-1',
  fecha_hora: '2026-10-13 12:00:00', subtotal: 3, descuento: 0, impuestos: 0, total: 3,
  metodo_pago: 'EFECTIVO', monto_recibido: 3, cambio: 0, estado: 'CONFIRMADA', items: []
};
const invoice: Omit<ReceptionInvoice, 'id'> = {
  providerId: 3, provider: 'Otro proveedor', invoiceNumber: 'FAC-3', date: '2026-10-13', totalUnits: 1, totalAmount: 2,
  items: [{ id: '1', code: 'INTERNAL', name: 'Producto', quantityReceived: 1, unitCost: 2, previousCost: 2, salePrice: 3 }]
};

function createdProduct(category: Product['category'], categoryId: number): BackendProduct {
  return {
    id_producto: 2, id_categoria: categoryId, categoria_nombre: category, codigo_interno: 'NEW', nombre: 'Nuevo producto',
    unidad_medida: 'UN', precio_compra_actual: 2, precio_venta_actual: 3, margen_minimo_porcentaje: 20,
    stock_minimo: 1, stock_actual: 4, permite_fraccion: false, activo: true, codigos_barras: ['NEW-BARCODE']
  };
}

let store: StoreContextType;
let renderer: ReactTestRenderer;
function Probe() { store = useStore(); return null; }

beforeEach(async (t) => {
  if (!('mock' in t)) throw new Error('A test context is required');
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const data = new Map<string, string>([
    ['tienda_products', JSON.stringify([product])], ['tienda_sales', '[]'], ['tienda_kardex', '[]']
  ]);
  (globalThis as any).localStorage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) };
  (globalThis as any).window = { addEventListener() {}, removeEventListener() {} };
  (globalThis as any).document = { documentElement: { classList: { toggle() {} } } };
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(api, 'getProductos', async () => []);
  t.mock.method(api, 'getKardexGeneral', async () => []);
  t.mock.method(api, 'getVentas', async () => []);
  t.mock.method(api, 'getCajaActiva', async () => shift);
  t.mock.method(api, 'getPedidos', async () => []);
  t.mock.method(api, 'getTrabajadores', async () => []);
  t.mock.method(api, 'getProveedores', async () => []);
  await act(async () => { renderer = create(<StoreProvider><Probe /></StoreProvider>); });
  await act(async () => { store.addProductToCart(product); store.setCashReceived('3'); });
});

afterEach(async () => { await act(async () => { renderer.unmount(); }); });

test('backend rejection preserves cart and never creates a successful local ticket', async (t) => {
  t.mock.method(api, 'cobrarVenta', async () => { throw new ApiError('Stock insuficiente', 400); });
  await act(async () => { assert.equal(await store.confirmCheckout(), null); });
  assert.equal(store.cart.length, 1);
  assert.equal(store.sales.length, 0);
  assert.equal(store.products[0].stock, 10);
  assert.equal(store.kardexMovements.length, 0);
  assert.equal(store.isReceiptModalOpen, false);
  assert.match(store.toastMessage!, /Stock insuficiente/);
});

test('simultaneous checkout attempts send only one request', async (t) => {
  let resolve!: (value: BackendSale) => void;
  const pending = new Promise<BackendSale>(r => { resolve = r; });
  const checkout = t.mock.method(api, 'cobrarVenta', () => pending);
  let first!: Promise<unknown>;
  await act(async () => { first = store.confirmCheckout(); assert.equal(await store.confirmCheckout(), null); });
  assert.equal(store.isCheckingOut, true);
  assert.equal(checkout.mock.callCount(), 1);
  await act(async () => { resolve(sale); await first; });
  assert.equal(store.isCheckingOut, false);
  assert.equal(store.cart.length, 0);
  assert.equal(store.sales.length, 1);
});

test('retry after a lost response reuses the same checkout key', async (t) => {
  const checkout = t.mock.method(api, 'cobrarVenta', async () => { throw new TypeError('Network failure'); });
  await act(async () => { await store.confirmCheckout(); });
  const key = checkout.mock.calls[0].arguments[0].clave_idempotencia;
  checkout.mock.mockImplementation(async () => sale);
  await act(async () => { await store.confirmCheckout(); });
  assert.equal(checkout.mock.calls[1].arguments[0].clave_idempotencia, key);
  assert.equal(store.sales.length, 1);
  assert.equal(store.isReceiptModalOpen, true);
});

test('an uncertain checkout cannot be silently replaced with a different cart', async (t) => {
  const checkout = t.mock.method(api, 'cobrarVenta', async () => { throw new TypeError('Network failure'); });
  await act(async () => { await store.confirmCheckout(); });
  await act(async () => { store.updateCartQuantity(0, 2); store.setCashReceived('6'); });
  await act(async () => { await store.confirmCheckout(); });
  assert.equal(checkout.mock.callCount(), 1);
  assert.equal(store.sales.length, 0);
  assert.match(store.toastMessage!, /pendiente de confirmar/);
});

test('insufficient cash prevents requests from keyboard and button checkout paths', async (t) => {
  const checkout = t.mock.method(api, 'cobrarVenta', async () => sale);
  await act(async () => { store.setCashReceived('1'); });
  await act(async () => { await store.confirmCheckout(); });
  assert.equal(checkout.mock.callCount(), 0);
  assert.equal(store.cart.length, 1);
});

test('closing cash sets closed state without requesting another active session', async (t) => {
  t.mock.method(api, 'cerrarCaja', async () => ({ ...shift, estado: 'CERRADA', total_real_entregado: 20 }));
  const getActive = t.mock.method(api, 'getCajaActiva', async () => { throw new Error('Unexpected refresh'); });
  await act(async () => { await store.closeShift(20); });
  assert.equal(store.cashShift.isOpen, false);
  assert.equal(getActive.mock.callCount(), 0);
});

test('a failed close leaves the current cash session open', async (t) => {
  t.mock.method(api, 'cerrarCaja', async () => { throw new ApiError('Error', 400); });
  await act(async () => { await assert.rejects(store.closeShift(20)); });
  assert.equal(store.cashShift.isOpen, true);
});

test('purchase reception sends the selected supplier identifier', async (t) => {
  const purchase = t.mock.method(api, 'registrarCompra', async () => ({}));
  await act(async () => { await store.receivePurchases(invoice); });
  assert.equal(purchase.mock.calls[0].arguments[0].id_proveedor, 3);
});

test('failed purchase reception does not modify local inventory or kardex', async (t) => {
  t.mock.method(api, 'registrarCompra', async () => { throw new ApiError('Proveedor inválido', 400); });
  await act(async () => { await assert.rejects(store.receivePurchases(invoice)); });
  assert.equal(store.products[0].stock, 10);
  assert.equal(store.kardexMovements.length, 0);
});

test('failed refund does not locally return stock or withdraw money', async (t) => {
  t.mock.method(api, 'registrarDevolucion', async () => { throw new ApiError('Caja cerrada', 400); });
  const movement = t.mock.method(api, 'registrarMovimientoCaja', async () => shift);
  await act(async () => { await assert.rejects(store.returnProduct('1', 1, 'Devolución', 3, true)); });
  assert.equal(store.products[0].stock, 10);
  assert.equal(store.kardexMovements.length, 0);
  assert.equal(movement.mock.callCount(), 0);
});

test('a closed register response updates local state and blocks checkout', async (t) => {
  t.mock.method(api, 'getCajaActiva', async () => null);
  const checkout = t.mock.method(api, 'cobrarVenta', async () => sale);
  await act(async () => { await store.refreshCashShift(); });
  await act(async () => { await store.confirmCheckout(); });
  assert.equal(store.cashShift.isOpen, false);
  assert.equal(checkout.mock.callCount(), 0);
});

test('failed cash movements and float edits cannot appear as local success', async (t) => {
  t.mock.method(api, 'registrarMovimientoCaja', async () => { throw new ApiError('Caja cerrada', 400); });
  t.mock.method(api, 'actualizarFondoInicial', async () => { throw new ApiError('Caja cerrada', 400); });
  await act(async () => { await assert.rejects(store.addCashMovement('RETIRO', 'Gasto', 3)); });
  await act(async () => { await assert.rejects(store.updateInitialCash(50)); });
  assert.equal(store.cashShift.expectedCash, 20);
  assert.equal(store.cashShift.initialCash, 20);
  assert.equal(store.cashShift.movements.length, 0);
});

test('reception merges repeated barcode scans and sends the supplier selected in the UI', async (t) => {
  t.mock.method(api, 'getProveedores', async () => [
    { id_proveedor: 1, ruc_ci: '1', razon_social: 'Arca' },
    { id_proveedor: 3, ruc_ci: '3', razon_social: 'Otro proveedor' }
  ]);
  t.mock.method(api, 'getIAConfig', async () => ({ configurado: false, api_key_mascara: '' }));
  const purchase = t.mock.method(api, 'registrarCompra', async () => ({}));
  await act(async () => { renderer.update(<StoreProvider><Probe /><ReceptionScreen /></StoreProvider>); });
  const select = renderer.root.findByType('select');
  await act(async () => { select.props.onChange({ target: { value: '3' } }); });
  for (let i = 0; i < 2; i++) {
    const input = renderer.root.findAllByType('input').find(n => n.props.placeholder?.startsWith('Escanear código'))!;
    await act(async () => { input.props.onChange({ target: { value: 'BARCODE' } }); });
    await act(async () => { renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  }
  const confirm = renderer.root.findAllByType('button').find(node =>
    node.findAllByType('span').some(span => span.children.includes('Confirmar e Ingresar a Stock [F10]'))
  )!;
  await act(async () => { await confirm.props.onClick(); });
  const payload = purchase.mock.calls[0].arguments[0];
  assert.equal(payload.id_proveedor, 3);
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].cantidad, 2);
});

for (const [category, categoryId] of [['Condimentos', 17], ['Hogar', 23]] as const) {
  test(`creating a ${category} product uses the category identifier from the backend`, async (t) => {
    t.mock.method(api, 'getCategorias', async () => [
      { id_categoria: 1, nombre: 'Abarrotes' }, { id_categoria: categoryId, nombre: category }
    ]);
    const save = t.mock.method(api, 'crearProducto', async () => createdProduct(category, categoryId));
    await act(async () => { await store.addProduct({ ...product, code: 'NEW', category }); });
    assert.equal(save.mock.calls[0].arguments[0].id_categoria, categoryId);
    assert.equal(store.products.find(p => p.id === '2')?.category, category);
  });
}

test('an unavailable category prevents product creation instead of saving under Abarrotes', async (t) => {
  t.mock.method(api, 'getCategorias', async () => [{ id_categoria: 1, nombre: 'Abarrotes' }]);
  const save = t.mock.method(api, 'crearProducto', async () => createdProduct('Hogar', 23));
  await act(async () => { await assert.rejects(store.addProduct({ ...product, category: 'Hogar' }), /categoría "Hogar"/); });
  assert.equal(save.mock.callCount(), 0);
  assert.equal(store.products.length, 1);
  assert.match(store.toastMessage!, /No se creó el producto/);
});

test('rejected product creation cannot appear as a successful local product', async (t) => {
  t.mock.method(api, 'getCategorias', async () => [{ id_categoria: 23, nombre: 'Hogar' }]);
  t.mock.method(api, 'crearProducto', async () => { throw new ApiError('Código duplicado', 400); });
  await act(async () => { await assert.rejects(store.addProduct({ ...product, category: 'Hogar' }), /Código duplicado/); });
  assert.equal(store.products.length, 1);
  assert.equal(store.kardexMovements.length, 0);
  assert.match(store.toastMessage!, /No se creó el producto: Código duplicado/);
});

test('the new product form stays open and preserves the selected category when saving fails', async (t) => {
  t.mock.method(api, 'getCategorias', async () => [{ id_categoria: 23, nombre: 'Hogar' }]);
  t.mock.method(api, 'crearProducto', async () => { throw new ApiError('Código duplicado', 400); });
  await act(async () => {
    store.setIsNewProductModalOpen(true);
    renderer.update(<StoreProvider><Probe /><NewProductModal /></StoreProvider>);
  });
  await act(async () => {
    renderer.root.findAllByType('input').find(n => n.props.placeholder === 'Ej: Leche Entera 1 Litro')!.props.onChange({ target: { value: 'Jabón' } });
    renderer.root.findAllByType('select')[0].props.onChange({ target: { value: 'Hogar' } });
  });
  await act(async () => { await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  assert.equal(store.isNewProductModalOpen, true);
  assert.equal(renderer.root.findAllByType('select')[0].props.value, 'Hogar');
  assert.equal(renderer.root.findAllByType('input').find(n => n.props.placeholder === 'Ej: Leche Entera 1 Litro')!.props.value, 'Jabón');
  assert.equal(renderer.root.findAllByType('button').find(n => n.props.type === 'submit')!.props.disabled, false);
  assert.equal(store.products.length, 1);
});

test('the new product form waits for saving and prevents repeated submissions', async (t) => {
  let resolve!: (value: BackendProduct) => void;
  const pending = new Promise<BackendProduct>(r => { resolve = r; });
  t.mock.method(api, 'getCategorias', async () => [{ id_categoria: 17, nombre: 'Condimentos' }]);
  const save = t.mock.method(api, 'crearProducto', () => pending);
  await act(async () => {
    store.setIsNewProductModalOpen(true);
    renderer.update(<StoreProvider><Probe /><NewProductModal /></StoreProvider>);
  });
  await act(async () => {
    renderer.root.findAllByType('input').find(n => n.props.placeholder === 'Ej: Leche Entera 1 Litro')!.props.onChange({ target: { value: 'Orégano' } });
    renderer.root.findAllByType('select')[0].props.onChange({ target: { value: 'Condimentos' } });
  });
  let first!: Promise<void>;
  await act(async () => {
    const form = renderer.root.findByType('form');
    first = form.props.onSubmit({ preventDefault() {} });
    await form.props.onSubmit({ preventDefault() {} });
  });
  assert.equal(store.isNewProductModalOpen, true);
  assert.equal(renderer.root.findAllByType('button').find(n => n.props.type === 'submit')!.props.disabled, true);
  assert.equal(save.mock.callCount(), 1);
  await act(async () => { resolve(createdProduct('Condimentos', 17)); await first; });
  assert.equal(store.isNewProductModalOpen, false);
  assert.equal(store.products.find(p => p.id === '2')?.category, 'Condimentos');
});

test('failed quick product creation preserves the form and barcode without adding a cart item', async (t) => {
  t.mock.method(api, 'getCategorias', async () => [{ id_categoria: 23, nombre: 'Hogar' }]);
  t.mock.method(api, 'crearProducto', async () => { throw new ApiError('Código duplicado', 400); });
  await act(async () => {
    store.setUnknownBarcode('NEW-BARCODE');
    store.setIsAltaAlVueloOpen(true);
    renderer.update(<StoreProvider><Probe /><AltaAlVueloModal /></StoreProvider>);
  });
  await act(async () => {
    renderer.root.findAllByType('input').find(n => n.props.placeholder === 'Ej: Galletas Oreo 36g')!.props.onChange({ target: { value: 'Jabón' } });
    renderer.root.findAllByType('select')[0].props.onChange({ target: { value: 'Hogar' } });
  });
  await act(async () => { await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  assert.equal(store.isAltaAlVueloOpen, true);
  assert.equal(store.unknownBarcode, 'NEW-BARCODE');
  assert.equal(renderer.root.findAllByType('select')[0].props.value, 'Hogar');
  assert.equal(store.products.length, 1);
  assert.equal(store.cart.length, 1);
  assert.equal(renderer.root.findAllByType('button').find(n => n.props.type === 'submit')!.props.disabled, false);
});

test('fractional barcode multiplier, split combo lines, and zero-stock sales are allowed', async () => {
  const arroz: Product = {
    id: '20', code: 'GRN-ARR-MAR', name: 'Arroz Maraqueño', category: 'Abarrotes',
    costPrice: 0.35, salePrice: 0.50, stock: 5, minStock: 1, unit: 'LIBRA', allowFraction: true
  };
  const huevo: Product = {
    id: '21', code: 'GRN-HUV-UNI', name: 'Huevo', category: 'Abarrotes',
    costPrice: 0.11, salePrice: 0.15, stock: 7, minStock: 6, unit: 'UNIDAD', allowFraction: false,
    description: 'Promo: 6 x $1.00'
  };
  const sinStock: Product = {
    id: '22', code: 'BEB-PEP-300', name: 'PEPSI 300 ML PET', category: 'Bebidas',
    costPrice: 0.182, salePrice: 0.25, stock: 0, minStock: 2, unit: 'UNIDAD', allowFraction: false
  };

  await act(async () => {
    store.clearCart();
    store.addProductToCart(arroz, 0.5);
    store.addProductToCart(huevo, 1);
    store.addProductToCart(huevo, 6, { unitPrice: Number((1 / 6).toFixed(6)), promoLabel: '6 × $1.00' });
  });

  assert.equal(store.cart.length, 3);
  assert.equal(store.cart[0].quantity, 0.5);
  assert.equal(store.cart[0].subtotal, 0.25);
  assert.equal(store.cart[1].quantity, 1);
  assert.equal(store.cart[1].subtotal, 0.15);
  assert.equal(store.cart[2].quantity, 6);
  assert.equal(store.cart[2].subtotal, 1.00);

  // Adding above current stock and adding stock-0 items are both permitted
  await act(async () => {
    store.addProductToCart(huevo, 1);
    store.addProductToCart(sinStock, 2);
  });
  assert.equal(store.cart[1].quantity, 2);
  assert.equal(store.cart.length, 4);
  assert.equal(store.cart[3].product.code, 'BEB-PEP-300');
  assert.equal(store.cart[3].quantity, 2);

  await act(async () => {
    store.updateCartQuantity(3, 5);
  });
  assert.equal(store.cart[3].quantity, 5);
});

test('BulkSaleModal renders unbarcoded items and adds combo 6x$1.00 even at stock 0', async (t) => {
  const arrozBp: BackendProduct = {
    id_producto: 30, id_categoria: 1, categoria_nombre: 'Abarrotes', codigo_interno: 'GRN-ARR',
    nombre: 'Arroz Conejo', unidad_medida: 'LIBRA', precio_compra_actual: 0.5, precio_venta_actual: 0.75,
    margen_minimo_porcentaje: 20, stock_minimo: 5, stock_actual: 20, permite_fraccion: true, activo: true,
    codigos_barras: []
  };
  const huevoBp: BackendProduct = {
    id_producto: 31, id_categoria: 1, categoria_nombre: 'Abarrotes', codigo_interno: 'GRN-HUV',
    nombre: 'Huevo Blanco', descripcion: 'Promo: 6 x $1.00', unidad_medida: 'UNIDAD',
    precio_compra_actual: 0.11, precio_venta_actual: 0.15, margen_minimo_porcentaje: 20,
    stock_minimo: 6, stock_actual: 0, permite_fraccion: false, activo: true, codigos_barras: []
  };
  t.mock.method(api, 'getProductos', async () => [arrozBp, huevoBp]);

  await act(async () => {
    await store.refreshProducts();
    renderer.update(<StoreProvider><Probe /><BulkSaleModal isOpen={true} onClose={() => {}} /></StoreProvider>);
  });
  await act(async () => {
    store.clearCart();
  });

  const textOf = (node: any): string =>
    typeof node === 'string' || typeof node === 'number'
      ? String(node)
      : Array.isArray(node?.children)
      ? node.children.map(textOf).join('')
      : '';

  // Trigger quick combo button for Huevo Blanco (6 x $1.00) even when stock is 0
  const comboBtn = renderer.root.findAllByType('button').find(
    btn => textOf(btn).includes('Combo 6 × $1.00')
  );
  assert.ok(comboBtn, 'Expected quick combo button in BulkSaleModal');
  assert.ok(!comboBtn.props.disabled, 'Combo button should not be disabled at stock 0');
  await act(async () => {
    comboBtn.props.onClick({ stopPropagation() {} });
  });
  assert.equal(store.cart.length, 1);
  assert.equal(store.cart[0].product.name, 'Huevo Blanco');
  assert.equal(store.cart[0].quantity, 6);
  assert.equal(store.cart[0].subtotal, 1.00);

  // Mobile two-step flow: clicking product card opens detail view and survives parent re-renders
  const searchInput = renderer.root.findByProps({
    placeholder: 'Buscar arroz, tomate, huevo, maduro, lenteja, limón...'
  });
  await act(async () => {
    searchInput.props.onChange({ target: { value: 'arroz' } });
  });
  const arrozCard = renderer.root.findAll(n => n.type === 'div' && typeof n.props?.onClick === 'function' && textOf(n).includes('Arroz Conejo'))[0];
  await act(async () => {
    arrozCard.props.onClick();
  });
  const backBtn = renderer.root.findAllByType('button').find(btn => textOf(btn).includes('Volver a la lista de productos'));
  assert.ok(backBtn, 'Expected mobile back-to-list button in BulkSaleModal detail step');
  assert.ok(String(backBtn.parent?.parent?.props?.className || '').includes('flex-1'));

  // Parent re-render with a fresh inline onClose must NOT reset mobile detail step or search
  await act(async () => {
    renderer.update(<StoreProvider><Probe /><BulkSaleModal isOpen={true} onClose={() => {}} /></StoreProvider>);
  });
  const searchAfter = renderer.root.findByProps({
    placeholder: 'Buscar arroz, tomate, huevo, maduro, lenteja, limón...'
  });
  assert.equal(searchAfter.props.value, 'arroz');
  const backBtnAfter = renderer.root.findAllByType('button').find(btn => textOf(btn).includes('Volver a la lista de productos'));
  assert.ok(String(backBtnAfter?.parent?.parent?.props?.className || '').includes('flex-1'));
});

test('SupplierSearchModal filters by supplier and adds zero-stock items without closing', async (t) => {
  const cafeBp: BackendProduct = {
    id_producto: 40, id_categoria: 3, categoria_nombre: 'Bebidas', id_proveedor: 7,
    proveedor_nombre: 'DIPOR S.A', codigo_interno: 'BEB-CAFE-MOC',
    nombre: 'CAFE LATO MOCACCINO VD 285 ML', unidad_medida: 'UNIDAD',
    precio_compra_actual: 1.847, precio_venta_actual: 2.50, margen_minimo_porcentaje: 20,
    stock_minimo: 2, stock_actual: 2, permite_fraccion: false, activo: true, codigos_barras: []
  };
  const pepsiBp: BackendProduct = {
    id_producto: 41, id_categoria: 3, categoria_nombre: 'Bebidas', id_proveedor: 8,
    proveedor_nombre: 'Tesalia', codigo_interno: 'BEB-PEP-300',
    nombre: 'PEPSI 300 ML PET', unidad_medida: 'UNIDAD',
    precio_compra_actual: 0.182, precio_venta_actual: 0.25, margen_minimo_porcentaje: 20,
    stock_minimo: 2, stock_actual: 0, permite_fraccion: false, activo: true, codigos_barras: []
  };
  t.mock.method(api, 'getProductos', async () => [cafeBp, pepsiBp]);

  await act(async () => {
    await store.refreshProducts();
    renderer.update(
      <StoreProvider>
        <Probe />
        <SupplierSearchModal isOpen={true} onClose={() => {}} initialSupplier="DIPOR S.A" />
      </StoreProvider>
    );
  });
  await act(async () => {
    store.clearCart();
  });

  const textOf = (node: any): string =>
    typeof node === 'string' || typeof node === 'number'
      ? String(node)
      : Array.isArray(node?.children)
      ? node.children.map(textOf).join('')
      : '';

  // Initially filtered to DIPOR S.A -> CAFE LATO appears, PEPSI does not
  const headings = renderer.root.findAllByType('h3').map(h => textOf(h));
  assert.deepEqual(headings, ['CAFE LATO MOCACCINO VD 285 ML']);

  // Click Tesalia supplier in sidebar
  const tesaliaBtn = renderer.root.findAllByType('button').find(b => textOf(b).includes('Tesalia'));
  assert.ok(tesaliaBtn, 'Expected Tesalia supplier button');
  await act(async () => {
    tesaliaBtn.props.onClick();
  });

  const tesaliaHeadings = renderer.root.findAllByType('h3').map(h => textOf(h));
  assert.deepEqual(tesaliaHeadings, ['PEPSI 300 ML PET']);

  // Add stock-0 product directly from supplier view
  const addBtn = renderer.root.findAllByType('button').find(b => textOf(b).includes('Agregar'));
  assert.ok(addBtn, 'Expected Agregar button');
  await act(async () => {
    addBtn.props.onClick({ stopPropagation() {} });
  });
  assert.equal(store.cart.length, 1);
  assert.equal(store.cart[0].product.code, 'BEB-PEP-300');
  assert.equal(store.cart[0].quantity, 1);
});

test('PosScreen supplier instant suggestions and GlobalSearchModal supplier filter add items to cart', async (t) => {
  const manzBp: BackendProduct = {
    id_producto: 50, id_categoria: 3, categoria_nombre: 'Bebidas', id_proveedor: 7,
    proveedor_nombre: 'DIPOR S.A', codigo_interno: 'BEB-MAN-300',
    nombre: 'MANZANA 300 ML PET', unidad_medida: 'UNIDAD',
    precio_compra_actual: 0.182, precio_venta_actual: 0.25, margen_minimo_porcentaje: 20,
    stock_minimo: 2, stock_actual: 10, permite_fraccion: false, activo: true, codigos_barras: []
  };
  const arrozBp: BackendProduct = {
    id_producto: 51, id_categoria: 1, categoria_nombre: 'Abarrotes',
    codigo_interno: 'GRN-ARR-CON', nombre: 'Arroz Conejo', unidad_medida: 'LIBRA',
    precio_compra_actual: 0.50, precio_venta_actual: 0.75, margen_minimo_porcentaje: 20,
    stock_minimo: 5, stock_actual: 0, permite_fraccion: true, activo: true, codigos_barras: []
  };
  t.mock.method(api, 'getProductos', async () => [manzBp, arrozBp]);

  await act(async () => {
    await store.refreshProducts();
    renderer.update(<StoreProvider><Probe /><PosScreen /></StoreProvider>);
  });
  await act(async () => {
    store.clearCart();
  });

  const textOf = (node: any): string =>
    typeof node === 'string' || typeof node === 'number'
      ? String(node)
      : Array.isArray(node?.children)
      ? node.children.map(textOf).join('')
      : '';

  // Type supplier name in PosScreen search input without barcode scanner
  const searchInput = renderer.root.findByProps({
    'aria-label': 'Buscar por nombre, proveedor, código de barras y cantidad'
  });
  await act(async () => {
    searchInput.props.onChange({ target: { value: 'dipor' } });
  });

  const suggestionBtn = renderer.root.findAllByType('button').find(b =>
    textOf(b).includes('MANZANA 300 ML PET') && textOf(b).includes('DIPOR S.A')
  );
  assert.ok(suggestionBtn, 'Expected instant suggestion matched by supplier name');
  await act(async () => {
    suggestionBtn.props.onClick();
  });
  assert.equal(store.cart.length, 1);
  assert.equal(store.cart[0].product.code, 'BEB-MAN-300');

  // Verify GlobalSearchModal supplier select filter
  await act(async () => {
    renderer.update(<StoreProvider><Probe /><GlobalSearchModal /></StoreProvider>);
  });
  await act(async () => {
    store.setIsGlobalSearchOpen(true);
  });

  const provSelect = renderer.root.findByProps({
    'aria-label': 'Filtrar búsqueda global por proveedor'
  });
  await act(async () => {
    provSelect.props.onChange({ target: { value: 'DIPOR S.A' } });
  });

  const globalResults = renderer.root.findAllByType('h4').map(h => textOf(h));
  assert.deepEqual(globalResults, ['MANZANA 300 ML PET']);
});

test('mobile and tablet navigation, jump-to-checkout, and touch autofocus guard behave cleanly', async () => {
  // Touch device (pointer: fine -> false) suppresses unsolicited autofocus
  (globalThis as any).document.addEventListener = () => {};
  (globalThis as any).document.removeEventListener = () => {};
  (globalThis as any).window.matchMedia = (q: string) => ({ matches: q !== '(pointer: fine)' });
  assert.equal(canAutoFocusInput(), false);
  (globalThis as any).window.matchMedia = (q: string) => ({ matches: q === '(pointer: fine)' });
  assert.equal(canAutoFocusInput(), true);

  let menuToggled = false;
  let menuClosed = false;
  await act(async () => {
    renderer.update(
      <StoreProvider>
        <Probe />
        <TopHeader onToggleMobileMenu={() => { menuToggled = true; }} />
        <Sidebar isMobileOpen={true} onCloseMobile={() => { menuClosed = true; }} />
        <PosScreen />
        <MobileBottomNav onOpenMore={() => { menuToggled = true; }} />
      </StoreProvider>
    );
  });

  const textOf = (node: any): string =>
    typeof node === 'string' || typeof node === 'number'
      ? String(node)
      : Array.isArray(node?.children)
      ? node.children.map(textOf).join('')
      : '';

  // Hamburger triggers drawer toggle; selecting Inventario switches screen and closes drawer
  const openMenuBtn = renderer.root.findByProps({ 'aria-label': 'Abrir menú' });
  await act(async () => {
    openMenuBtn.props.onClick();
  });
  assert.equal(menuToggled, true);

  const invBtns = renderer.root.findAllByType('button').filter(b => textOf(b).trim() === 'Inventario');
  assert.ok(invBtns.length >= 2, 'Expected Inventario nav in drawer and bottom bar');
  await act(async () => {
    invBtns[0].props.onClick();
  });
  assert.equal(store.activeScreen, 'inventory');
  assert.equal(menuClosed, true);

  // Cart has preloaded item in beforeEach -> mobile/tablet "Ir a Cobrar" quick jump renders cleanly
  const jumpBtn = renderer.root.findAllByType('button').find(b => textOf(b).includes('Ir a Cobrar'));
  assert.ok(jumpBtn, 'Expected mobile/tablet quick jump button to checkout panel');
});

test('camera barcode scanner configures reader and works across POS, Inventory, NewProduct, and Reception', async () => {
  (globalThis as any).document.addEventListener = () => {};
  (globalThis as any).document.removeEventListener = () => {};
  (globalThis as any).window.matchMedia = () => ({ matches: false });

  const reader = createBarcodeReader();
  assert.equal(typeof reader.decodeFromConstraints, 'function');
  assert.equal(typeof reader.decodeFromImageElement, 'function');

  // 1. PosScreen: open camera scanner, scan known barcode, and auto-close on unknown barcode for Alta al Vuelo
  await act(async () => {
    store.clearCart();
    renderer.update(<StoreProvider><Probe /><PosScreen /></StoreProvider>);
  });
  await act(async () => {
    store.clearCart();
  });

  const posCamBtn = renderer.root.findByProps({ 'aria-label': 'Escanear código de barras con cámara' });
  await act(async () => {
    posCamBtn.props.onClick();
  });

  let modal = renderer.root.findByType(BarcodeCameraModal);
  assert.equal(modal.props.isOpen, true);
  assert.equal(modal.props.allowContinuous, true);

  const fileInput = renderer.root.findByProps({ capture: 'environment' });
  assert.equal(fileInput.props.accept, 'image/*');

  // Scan known barcode -> adds item to cart and keeps camera open in continuous mode with feedback
  await act(async () => {
    modal.props.onDetected('BARCODE');
  });
  assert.equal(store.cart.length, 1);
  assert.equal(store.cart[0].product.code, 'INTERNAL');
  modal = renderer.root.findByType(BarcodeCameraModal);
  assert.equal(modal.props.isOpen, true);
  assert.match(modal.props.lastFeedback ?? '', /Producto/);

  // Scan unknown barcode -> closes camera scanner and triggers Alta al Vuelo modal
  await act(async () => {
    modal.props.onDetected('7861009998887');
  });
  modal = renderer.root.findByType(BarcodeCameraModal);
  assert.equal(modal.props.isOpen, false);
  assert.equal(store.isAltaAlVueloOpen, true);
  assert.equal(store.unknownBarcode, '7861009998887');

  // 2. NewProductModal: camera fills barcode field
  await act(async () => {
    store.setIsAltaAlVueloOpen(false);
    renderer.update(<StoreProvider><Probe /><NewProductModal /></StoreProvider>);
  });
  await act(async () => {
    store.setIsNewProductModalOpen(true);
  });

  const newProdCamBtn = renderer.root.findByProps({ 'aria-label': 'Escanear código de barras con cámara' });
  await act(async () => {
    newProdCamBtn.props.onClick();
  });
  const newProdCamModal = renderer.root.findByType(BarcodeCameraModal);
  assert.equal(newProdCamModal.props.isOpen, true);
  await act(async () => {
    newProdCamModal.props.onDetected('7861001234567');
  });
  const barcodeInput = renderer.root.findByProps({ placeholder: 'Opcional' });
  assert.equal(barcodeInput.props.value, '7861001234567');

  // 3. InventoryScreen & ReceptionScreen: camera scan buttons open BarcodeCameraModal cleanly
  await act(async () => {
    renderer.update(<StoreProvider><Probe /><InventoryScreen /></StoreProvider>);
  });
  const invCamBtn = renderer.root.findByProps({ 'aria-label': 'Escanear código de barras para buscar' });
  await act(async () => {
    invCamBtn.props.onClick();
  });
  const invCamModal = renderer.root.findByType(BarcodeCameraModal);
  assert.equal(invCamModal.props.isOpen, true);
  await act(async () => {
    invCamModal.props.onDetected('BARCODE');
  });
  const invSearchInput = renderer.root.findByProps({
    placeholder: 'Buscar por nombre, código de factura o código de barras...'
  });
  assert.equal(invSearchInput.props.value, 'BARCODE');

  await act(async () => {
    renderer.update(<StoreProvider><Probe /><ReceptionScreen /></StoreProvider>);
  });
  const recCamBtn = renderer.root.findByProps({ 'aria-label': 'Escanear código de barras con cámara' });
  await act(async () => {
    recCamBtn.props.onClick();
  });
  const recCamModal = renderer.root.findByType(BarcodeCameraModal);
  assert.equal(recCamModal.props.isOpen, true);
  await act(async () => {
    recCamModal.props.onDetected('BARCODE');
  });
  assert.match(recCamModal.props.lastFeedback ?? '', /Producto/);
});

test('BarcodeCameraModal discards late photo decodes after close and TopHeader search shrinks on tablet', async () => {
  (globalThis as any).document.addEventListener = () => {};
  (globalThis as any).document.removeEventListener = () => {};
  const prevCreateUrl = URL.createObjectURL;
  const prevRevokeUrl = URL.revokeObjectURL;
  const prevImage = (globalThis as any).Image;
  const prevDetector = (globalThis as any).window.BarcodeDetector;

  let resolveDetect!: (res: Array<{ rawValue?: string }>) => void;
  const detectPromise = new Promise<Array<{ rawValue?: string }>>(res => { resolveDetect = res; });

  URL.createObjectURL = () => 'blob:mock-barcode';
  URL.revokeObjectURL = () => {};
  (globalThis as any).Image = class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) {
      queueMicrotask(() => this.onload?.());
    }
  };
  (globalThis as any).window.BarcodeDetector = class MockDetector {
    detect() {
      return detectPromise;
    }
  };

  let detectedCount = 0;
  try {
    await act(async () => {
      renderer.update(
        <StoreProvider>
          <Probe />
          <TopHeader onToggleMobileMenu={() => {}} />
          <BarcodeCameraModal
            isOpen={true}
            onClose={() => {}}
            onDetected={() => { detectedCount += 1; }}
          />
        </StoreProvider>
      );
    });

    // Verify TopHeader quick search container permits tablet shrinking (`sm:min-w-0`)
    const searchBtn = renderer.root.findByProps({ 'aria-label': 'Buscar productos, precios o códigos (⌘K)' });
    assert.ok(String(searchBtn.parent?.props?.className || '').includes('sm:min-w-0'));
    assert.ok(String(searchBtn.props.className || '').includes('sm:min-w-0'));

    // Start async photo decode, then close modal BEFORE detect() resolves
    const fileInput = renderer.root.findByProps({ capture: 'environment' });
    let pendingPhoto!: Promise<void>;
    await act(async () => {
      pendingPhoto = fileInput.props.onChange({
        target: { files: [{ name: 'barcode.jpg' }], value: 'x' }
      });
    });

    await act(async () => {
      renderer.update(
        <StoreProvider>
          <Probe />
          <TopHeader onToggleMobileMenu={() => {}} />
          <BarcodeCameraModal
            isOpen={false}
            onClose={() => {}}
            onDetected={() => { detectedCount += 1; }}
          />
        </StoreProvider>
      );
    });

    await act(async () => {
      resolveDetect([{ rawValue: '7861001234567' }]);
      await pendingPhoto;
    });

    assert.equal(detectedCount, 0);
  } finally {
    URL.createObjectURL = prevCreateUrl;
    URL.revokeObjectURL = prevRevokeUrl;
    (globalThis as any).Image = prevImage;
    (globalThis as any).window.BarcodeDetector = prevDetector;
  }
});

test('formatPromoDescription and isBulkEligibleProduct handle combos and unbarcoded rules', () => {
  assert.equal(formatPromoDescription('5', '1.00'), 'Promo: 5 x $1.00');
  assert.equal(formatPromoDescription('6', '1', 'Grande'), 'Promo: 6 x $1.00 — Grande');
  assert.equal(formatPromoDescription('', '', '  Suelto '), 'Suelto');
  assert.equal(formatPromoDescription('', ''), undefined);

  assert.equal(
    isBulkEligibleProduct({ unit: 'UNIDAD', allowFraction: false, category: 'Varios', description: 'Promo: 5 x $1.00' }),
    true
  );
  assert.equal(
    isBulkEligibleProduct({ unit: 'LIBRA', allowFraction: false, category: 'Varios', description: undefined }),
    true
  );
  assert.equal(
    isBulkEligibleProduct({ unit: 'UNIDAD', allowFraction: false, category: 'Varios', description: undefined }),
    false
  );
});

test('BulkSaleModal creates bulk/combo products in-modal using store backend categories and selects them immediately', async (t) => {
  let createdPayload: any = null;
  t.mock.method(api, 'getCategorias', async () => [
    { id_categoria: 10, nombre: 'Papelería y Cartulinas' },
    { id_categoria: 11, nombre: 'Varios y Escolar' }
  ]);
  t.mock.method(api, 'crearProducto', async (payload: any) => {
    createdPayload = payload;
    return {
      id_producto: 99,
      id_categoria: payload.id_categoria,
      categoria_nombre: 'Papelería y Cartulinas',
      codigo_interno: payload.codigo_interno,
      nombre: payload.nombre,
      descripcion: payload.descripcion,
      unidad_medida: payload.unidad_medida,
      precio_compra_actual: payload.precio_compra_actual,
      precio_venta_actual: payload.precio_venta_actual,
      margen_minimo_porcentaje: 20,
      stock_minimo: 5,
      stock_actual: payload.stock_actual,
      permite_fraccion: payload.permite_fraccion,
      activo: true,
      codigos_barras: []
    } as BackendProduct;
  });

  await act(async () => {
    renderer = create(
      <StoreProvider>
        <Probe />
        <BulkSaleModal isOpen={true} onClose={() => {}} />
      </StoreProvider>
    );
  });

  // Open in-modal creation form from header button
  const newBulkBtn = renderer.root.findByProps({ title: 'Crear producto a granel, combo o sin código' });
  await act(async () => {
    newBulkBtn.props.onClick();
  });

  // Verify backend categories loaded into select dropdown
  const select = renderer.root.findAllByType('select')[0];
  const optionValues = select.findAllByType('option').map((o) => o.props.value);
  assert.ok(optionValues.includes('Papelería y Cartulinas'));
  assert.ok(optionValues.includes('Varios y Escolar'));

  const nameInput = renderer.root.findByProps({ placeholder: 'Ej: Arroz Conejo, Huevo, Cartulina A4...' });
  const comboQtyInput = renderer.root.findByProps({ placeholder: 'Ej: 6' });
  const comboTotalInput = renderer.root.findByProps({ placeholder: 'Ej: 1.00' });
  const numberInputs = renderer.root.findAllByType('input').filter((i) => i.props.type === 'number');
  // numberInputs order: salePrice, costPrice, stock, comboQty, comboTotal
  const salePriceInput = numberInputs[0];
  const stockInput = numberInputs[2];

  await act(async () => {
    nameInput.props.onChange({ target: { value: 'Cartulina A4' } });
    select.props.onChange({ target: { value: 'Papelería y Cartulinas' } });
    salePriceInput.props.onChange({ target: { value: '0.25' } });
    stockInput.props.onChange({ target: { value: '40' } });
    comboQtyInput.props.onChange({ target: { value: '5' } });
    comboTotalInput.props.onChange({ target: { value: '1.00' } });
  });

  const form = renderer.root.findByType('form');
  await act(async () => {
    await form.props.onSubmit({ preventDefault() {} });
  });

  assert.equal(createdPayload.id_categoria, 10);
  assert.equal(createdPayload.nombre, 'Cartulina A4');
  assert.equal(createdPayload.descripcion, 'Promo: 5 x $1.00');
  assert.deepEqual(createdPayload.codigos_barras, []);
  assert.equal(createdPayload.precio_venta_actual, 0.25);

  // Returns immediately to sale screen with promo button active
  const promoBtn = renderer.root.findAllByType('button').find((b) => {
    const text = b.findAllByType('span').map((s) => s.children.join('')).join(' ') + b.children.join('');
    return text.includes('Agregar 5 × $1.00') || text.includes('5 × $1.00');
  });
  assert.ok(promoBtn, 'Expected quick promo button "+ Agregar 5 × $1.00" after creation');

  await act(async () => {
    promoBtn!.props.onClick({ stopPropagation() {} });
  });

  assert.equal(store.cart.length, 1);
  assert.equal(store.cart[0].product.name, 'Cartulina A4');
  assert.equal(store.cart[0].quantity, 5);
  assert.equal(store.cart[0].subtotal, 1.0);
});

test('BulkSaleModal empty search CTA pre-fills the in-modal product name', async (t) => {
  t.mock.method(api, 'getCategorias', async () => [{ id_categoria: 1, nombre: 'Abarrotes' }]);
  await act(async () => {
    renderer = create(
      <StoreProvider>
        <Probe />
        <BulkSaleModal isOpen={true} onClose={() => {}} />
      </StoreProvider>
    );
  });

  const searchInput = renderer.root.findByProps({
    placeholder: 'Buscar arroz, tomate, huevo, maduro, lenteja, limón...'
  });
  await act(async () => {
    searchInput.props.onChange({ target: { value: 'Marcador Borrable' } });
  });

  const emptyCta = renderer.root.findAllByType('button').find((b) => {
    const text = b.findAllByType('span').map((s) => s.children.join('')).join(' ');
    return text.includes('Crear "Marcador Borrable" sin código');
  });
  assert.ok(emptyCta, 'Expected empty-state CTA button with searched query');

  await act(async () => {
    emptyCta!.props.onClick();
  });

  const nameInput = renderer.root.findByProps({ placeholder: 'Ej: Arroz Conejo, Huevo, Cartulina A4...' });
  assert.equal(nameInput.props.value, 'Marcador Borrable');
});

test('NewProductModal lists distributors and lets user create and auto-select a new distributor inline', async (t) => {
  let createdProductPayload: any = null;
  let createdProviderPayload: any = null;

  t.mock.method(api, 'getCategorias', async () => [{ id_categoria: 1, nombre: 'Abarrotes' }]);
  t.mock.method(api, 'getProveedores', async () => [
    { id_proveedor: 3, ruc_ci: '1790001112001', razon_social: 'Arca Continental' }
  ]);
  t.mock.method(api, 'crearProveedor', async (payload: any) => {
    createdProviderPayload = payload;
    return {
      id_proveedor: 77,
      ruc_ci: payload.ruc_ci || 'RUC-77',
      razon_social: payload.razon_social
    };
  });
  t.mock.method(api, 'crearProducto', async (payload: any) => {
    createdProductPayload = payload;
    return {
      ...createdProduct('Abarrotes', 1),
      id_producto: 201,
      id_proveedor: payload.id_proveedor,
      proveedor_nombre: 'Distribuidora Andina',
      nombre: payload.nombre
    };
  });

  await act(async () => {
    store.setIsNewProductModalOpen(true);
    renderer.update(<StoreProvider><Probe /><NewProductModal /></StoreProvider>);
  });

  // Verify existing distributor is listed alongside sentinel "+ Añadir distribuidor nuevo..."
  const provSelect = renderer.root.findByProps({ 'aria-label': 'Distribuidor' });
  const provOptions = provSelect.findAllByType('option').map((o) => o.props.value);
  assert.ok(provOptions.includes('3'));
  assert.ok(provOptions.includes('__NEW__'));

  // Choosing sentinel opens inline distributor panel
  await act(async () => {
    provSelect.props.onChange({ target: { value: '__NEW__' } });
  });

  const newProvNameInput = renderer.root.findByProps({ 'aria-label': 'Nombre del nuevo distribuidor' });
  const newProvRucInput = renderer.root.findByProps({ 'aria-label': 'RUC o Cédula del distribuidor' });
  await act(async () => {
    newProvNameInput.props.onChange({ target: { value: 'Distribuidora Andina' } });
    newProvRucInput.props.onChange({ target: { value: '1799998887001' } });
  });

  const saveProvBtn = renderer.root.findAllByType('button').find((b) =>
    b.findAllByType('span').some((s) => s.children.join('') === 'Guardar Distribuidor')
  );
  assert.ok(saveProvBtn, 'Expected Guardar Distribuidor button');
  await act(async () => {
    await saveProvBtn!.props.onClick();
  });

  assert.equal(createdProviderPayload.razon_social, 'Distribuidora Andina');
  assert.equal(createdProviderPayload.ruc_ci, '1799998887001');
  assert.equal(renderer.root.findByProps({ 'aria-label': 'Distribuidor' }).props.value, '77');

  // Now submit the new product and verify id_proveedor and distributor are saved
  const nameInput = renderer.root.findByProps({ placeholder: 'Ej: Leche Entera 1 Litro' });
  await act(async () => {
    nameInput.props.onChange({ target: { value: 'Aceite Girasol 1L' } });
  });
  await act(async () => {
    await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
  });

  assert.equal(createdProductPayload.id_proveedor, 77);
  const saved = store.products.find((p) => p.id === '201');
  assert.equal(saved?.providerId, 77);
  assert.equal(saved?.distributor, 'Distribuidora Andina');
});

test('AltaAlVueloModal and BulkSaleModal list distributors and forward selected or created id_proveedor', async (t) => {
  const createdPayloads: any[] = [];
  t.mock.method(api, 'getCategorias', async () => [{ id_categoria: 10, nombre: 'Varios y Escolar' }]);
  t.mock.method(api, 'getProveedores', async () => [
    { id_proveedor: 5, ruc_ci: '0990005551001', razon_social: 'Papelera Nacional' }
  ]);
  t.mock.method(api, 'crearProducto', async (payload: any) => {
    createdPayloads.push(payload);
    return {
      ...createdProduct('Varios y Escolar', 10),
      id_producto: 300 + createdPayloads.length,
      id_proveedor: payload.id_proveedor,
      proveedor_nombre: payload.id_proveedor === 5 ? 'Papelera Nacional' : undefined,
      nombre: payload.nombre,
      codigos_barras: payload.codigos_barras || []
    };
  });

  // 1. BulkSaleModal -> New Bulk -> Select existing distributor 5
  await act(async () => {
    renderer = create(<StoreProvider><Probe /><BulkSaleModal isOpen={true} onClose={() => {}} /></StoreProvider>);
  });
  await act(async () => {
    renderer.root.findByProps({ title: 'Crear producto a granel, combo o sin código' }).props.onClick();
  });

  const bulkProvSelect = renderer.root.findByProps({ 'aria-label': 'Distribuidor' });
  await act(async () => {
    bulkProvSelect.props.onChange({ target: { value: '5' } });
    renderer.root.findByProps({ placeholder: 'Ej: Arroz Conejo, Huevo, Cartulina A4...' }).props.onChange({
      target: { value: 'Papel Bond Resma' }
    });
  });
  await act(async () => {
    await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
  });
  assert.equal(createdPayloads[0].id_proveedor, 5);

  // 2. AltaAlVueloModal -> uses backend category & sends selected distributor
  await act(async () => {
    store.setUnknownBarcode('7860000111222');
    store.setIsAltaAlVueloOpen(true);
    renderer.update(<StoreProvider><Probe /><AltaAlVueloModal /></StoreProvider>);
  });
  const altaCatSelect = renderer.root.findAllByType('select')[0];
  assert.ok(altaCatSelect.findAllByType('option').some((o) => o.props.value === 'Varios y Escolar'));
  await act(async () => {
    altaCatSelect.props.onChange({ target: { value: 'Varios y Escolar' } });
    renderer.root.findByProps({ 'aria-label': 'Distribuidor' }).props.onChange({ target: { value: '5' } });
    renderer.root.findByProps({ placeholder: 'Ej: Galletas Oreo 36g' }).props.onChange({
      target: { value: 'Cuaderno 100 Hojas' }
    });
  });
  await act(async () => {
    await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
  });
  assert.equal(createdPayloads[1].id_proveedor, 5);
  assert.equal(store.cart[0].product.distributor, 'Papelera Nacional');
});

test('InventoryScreen edit product modal allows renaming product, switching or creating distributor, and clearing distributor', async (t) => {
  (globalThis as any).document.addEventListener = () => {};
  (globalThis as any).document.removeEventListener = () => {};

  const updatePayloads: any[] = [];
  t.mock.method(api, 'getProveedores', async () => [
    { id_proveedor: 3, ruc_ci: '1790001112001', razon_social: 'Arca Continental' },
    { id_proveedor: 8, ruc_ci: '0998887776001', razon_social: 'Pronaca' }
  ]);
  t.mock.method(api, 'crearProveedor', async (payload: any) => ({
    id_proveedor: 42,
    ruc_ci: payload.ruc_ci || 'RUC-42',
    razon_social: payload.razon_social
  }));
  t.mock.method(api, 'actualizarProducto', async (_id: number, payload: any) => {
    updatePayloads.push(payload);
    return {
      ...createdProduct('Bebidas', 2),
      id_producto: 1,
      codigo_interno: 'INTERNAL',
      codigos_barras: ['BARCODE'],
      nombre: payload.nombre || 'Producto',
      id_proveedor: payload.id_proveedor ?? undefined,
      proveedor_nombre:
        payload.id_proveedor === 42
          ? 'Nuevo Distribuidor Editado'
          : payload.id_proveedor === 8
            ? 'Pronaca'
            : undefined
    };
  });

  await act(async () => {
    renderer.update(<StoreProvider><Probe /><InventoryScreen /></StoreProvider>);
  });

  // 1. Open edit modal and change name + create new distributor inline
  const editBtns = renderer.root.findAllByProps({ title: 'Editar Código de Barras y Precio' });
  await act(async () => {
    editBtns[0].props.onClick({ stopPropagation() {} });
  });

  const nameInput = renderer.root.findByProps({ 'aria-label': 'Nombre del producto' });
  const provSelect = renderer.root.findByProps({ 'aria-label': 'Distribuidor' });
  assert.ok(provSelect.findAllByType('option').some((o) => o.props.value === '8'));

  await act(async () => {
    nameInput.props.onChange({ target: { value: 'Producto Renombrado 2L' } });
    provSelect.props.onChange({ target: { value: '__NEW__' } });
  });

  await act(async () => {
    renderer.root.findByProps({ 'aria-label': 'Nombre del nuevo distribuidor' }).props.onChange({
      target: { value: 'Nuevo Distribuidor Editado' }
    });
  });

  const saveProvBtn = renderer.root.findAllByType('button').find((b) =>
    b.findAllByType('span').some((s) => s.children.join('') === 'Guardar Distribuidor')
  );
  await act(async () => {
    await saveProvBtn!.props.onClick();
  });

  await act(async () => {
    await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
  });

  assert.equal(updatePayloads[0].nombre, 'Producto Renombrado 2L');
  assert.equal(updatePayloads[0].id_proveedor, 42);
  assert.equal(store.products[0].name, 'Producto Renombrado 2L');
  assert.equal(store.products[0].distributor, 'Nuevo Distribuidor Editado');

  // 2. Re-open edit modal and clear distributor ("Sin distribuidor / General")
  await act(async () => {
    renderer.root.findAllByProps({ title: 'Editar Código de Barras y Precio' })[0].props.onClick({ stopPropagation() {} });
  });
  await act(async () => {
    renderer.root.findByProps({ 'aria-label': 'Distribuidor' }).props.onChange({ target: { value: '' } });
  });
  await act(async () => {
    await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
  });

  assert.equal(updatePayloads[1].id_proveedor, null);
  assert.equal(store.products[0].providerId, undefined);
  assert.equal(store.products[0].distributor, undefined);
});

test('LoginScreen toggles password visibility with eye button without submitting', async (t) => {
  const loginSpy = t.mock.method(api, 'login', async () => ({
    token: 'tok',
    usuario: { id_usuario: 1, username: 'admin', nombre_completo: 'Admin', rol: 'ADMINISTRADOR', debe_cambiar_clave: false }
  }));

  await act(async () => {
    renderer.update(<StoreProvider><Probe /><LoginScreen /></StoreProvider>);
  });

  const findPwdInput = () =>
    renderer.root.findAllByType('input').find((i) => i.props.autoComplete === 'current-password')!;

  assert.equal(findPwdInput().props.type, 'password');

  const showBtn = renderer.root.findByProps({ 'aria-label': 'Mostrar clave' });
  assert.equal(showBtn.props.type, 'button');
  await act(async () => {
    showBtn.props.onClick();
  });

  assert.equal(findPwdInput().props.type, 'text');
  assert.equal(loginSpy.mock.callCount(), 0);

  const hideBtn = renderer.root.findByProps({ 'aria-label': 'Ocultar clave' });
  await act(async () => {
    hideBtn.props.onClick();
  });

  assert.equal(findPwdInput().props.type, 'password');
});

test('InventoryScreen detects unknown barcode scans and opens NewProductModal pre-filled with the scanned barcode', async (t) => {
  (globalThis as any).document.addEventListener = () => {};
  (globalThis as any).document.removeEventListener = () => {};

  const createdPayloads: any[] = [];
  t.mock.method(api, 'getCategorias', async () => [{ id_categoria: 2, nombre: 'Bebidas' }]);
  t.mock.method(api, 'getProveedores', async () => []);
  t.mock.method(api, 'crearProducto', async (payload: any) => {
    createdPayloads.push(payload);
    return {
      ...createdProduct('Bebidas', 2),
      nombre: payload.nombre,
      codigos_barras: payload.codigos_barras || []
    };
  });

  await act(async () => {
    renderer.update(<StoreProvider><Probe /><InventoryScreen /><NewProductModal /></StoreProvider>);
  });

  // 1. Scan unknown barcode via camera button in Inventory
  const camBtn = renderer.root.findByProps({ 'aria-label': 'Escanear código de barras para buscar' });
  await act(async () => {
    camBtn.props.onClick();
  });
  const camModal = renderer.root.findAllByType(BarcodeCameraModal).find(m => m.props.isOpen)!;
  await act(async () => {
    camModal.props.onDetected('7861005559991');
  });

  const addWithCodeBtn = renderer.root.findAllByType('button').find(b =>
    b.findAllByType('span').some(s => s.children.join('') === 'Añadir producto con este código')
  );
  assert.ok(addWithCodeBtn, 'Expected add-product button for detected unknown barcode');

  // 2. Clicking "Añadir producto con este código" opens NewProductModal pre-filled
  await act(async () => {
    addWithCodeBtn!.props.onClick();
  });
  assert.equal(store.isNewProductModalOpen, true);
  assert.equal(renderer.root.findByProps({ 'aria-label': 'Código de barras' }).props.value, '7861005559991');

  await act(async () => {
    renderer.root.findByProps({ 'aria-label': 'Nombre del producto' }).props.onChange({
      target: { value: 'Jugo Naranja 1L' }
    });
  });
  await act(async () => {
    await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
  });

  assert.equal(store.isNewProductModalOpen, false);
  assert.deepEqual(createdPayloads[0].codigos_barras, ['7861005559991']);

  // 3. Re-opening via normal "Nuevo Producto" button starts with empty barcode
  const newProdHeaderBtn = renderer.root.findAllByType('button').find(b =>
    b.findAllByType('span').some(s => s.children.join('') === 'Nuevo Producto')
  );
  await act(async () => {
    newProdHeaderBtn!.props.onClick();
  });
  assert.equal(renderer.root.findByProps({ 'aria-label': 'Código de barras' }).props.value, '');

  // Close and test USB/keyboard Enter scan in Inventory search bar
  await act(async () => {
    store.setIsNewProductModalOpen(false);
  });
  const searchInput = renderer.root.findByProps({
    placeholder: 'Buscar por nombre, código de factura o código de barras...'
  });
  await act(async () => {
    searchInput.props.onChange({ target: { value: '7861007778882' } });
  });
  await act(async () => {
    searchInput.props.onKeyDown({ key: 'Enter', preventDefault() {} });
  });
  const enterAddBtn = renderer.root.findAllByType('button').find(b =>
    b.findAllByType('span').some(s => s.children.join('') === 'Añadir producto con este código')
  );
  assert.ok(enterAddBtn);
  await act(async () => {
    enterAddBtn!.props.onClick();
  });
  assert.equal(renderer.root.findByProps({ 'aria-label': 'Código de barras' }).props.value, '7861007778882');
});

test('global USB scanner in Inventory tab detects new product without triggering POS AltaAlVuelo', async (t) => {
  (globalThis as any).document.addEventListener = () => {};
  (globalThis as any).document.removeEventListener = () => {};

  const listeners = new Map<string, (e: any) => void>();
  (globalThis as any).window = {
    addEventListener(evt: string, fn: (e: any) => void) {
      listeners.set(evt, fn);
    },
    removeEventListener(evt: string) {
      listeners.delete(evt);
    }
  };
  t.mock.method(api, 'getCategorias', async () => [{ id_categoria: 2, nombre: 'Bebidas' }]);
  t.mock.method(api, 'getProveedores', async () => []);

  // Re-mount StoreProvider cleanly so its global keydown effect attaches to our mocked window
  let invStore!: StoreContextType;
  function InvProbe() { invStore = useStore(); return null; }
  await act(async () => {
    renderer.unmount();
  });
  await act(async () => {
    renderer = create(<StoreProvider><InvProbe /><InventoryScreen /><NewProductModal /></StoreProvider>);
  });
  await act(async () => {
    invStore.setActiveScreen('inventory');
  });

  const keydown = listeners.get('keydown');
  assert.ok(keydown, 'Expected global keydown listener');

  await act(async () => {
    for (const ch of '7869991112223') {
      keydown!({ key: ch, target: { tagName: 'BODY' }, preventDefault() {} });
    }
    keydown!({ key: 'Enter', target: { tagName: 'BODY' }, preventDefault() {} });
  });

  assert.equal(invStore.isAltaAlVueloOpen, false);
  const addWithCodeBtn = renderer.root.findAllByType('button').find(b =>
    b.findAllByType('span').some(s => s.children.join('') === 'Añadir producto con este código')
  );
  assert.ok(addWithCodeBtn, 'Expected new product button from global Inventory USB scan');

  await act(async () => {
    addWithCodeBtn!.props.onClick();
  });
  assert.equal(invStore.isNewProductModalOpen, true);
  assert.equal(renderer.root.findByProps({ 'aria-label': 'Código de barras' }).props.value, '7869991112223');
});

test('Sidebar includes Distribuidores tab, ProvidersScreen renames distributor and permanently removes products, and Inventory mobile menu hides sort modes', async (t) => {
  (globalThis as any).document.addEventListener = () => {};
  (globalThis as any).document.removeEventListener = () => {};

  let updatedProvPayload: any = null;
  let deletedProdId: number | null = null;

  t.mock.method(api, 'getProveedores', async () => [
    { id_proveedor: 10, ruc_ci: '1790001112001', razon_social: 'Distribuidora Alfa', telefono: '099111222' }
  ]);
  t.mock.method(api, 'actualizarProveedor', async (id: number, payload: any) => {
    updatedProvPayload = { id, payload };
    return {
      id_proveedor: id,
      ruc_ci: payload.ruc_ci || '1790001112001',
      razon_social: payload.razon_social,
      telefono: payload.telefono
    };
  });
  t.mock.method(api, 'eliminarProducto', async (id: number) => {
    deletedProdId = id;
    return { success: true, deleted_permanently: true, message: 'Producto eliminado de raíz del inventario' } as any;
  });

  const textOf = (node: any): string =>
    typeof node === 'string' || typeof node === 'number'
      ? String(node)
      : Array.isArray(node?.children)
      ? node.children.map(textOf).join('')
      : '';

  t.mock.method(api, 'getProductos', async () => [
    {
      ...createdProduct('Abarrotes', 1),
      id_producto: 15,
      codigo_interno: 'ALF-01',
      nombre: 'Fideo Alfa 400g',
      id_proveedor: 10,
      proveedor_nombre: 'Distribuidora Alfa'
    }
  ]);

  let provStore!: StoreContextType;
  function ProvProbe() { provStore = useStore(); return null; }

  // 1. Sidebar drawer includes Distribuidores tab and switches activeScreen to 'providers'
  let drawerClosed = false;
  await act(async () => {
    renderer.unmount();
  });
  await act(async () => {
    renderer = create(
      <StoreProvider>
        <ProvProbe />
        <Sidebar isMobileOpen={true} onCloseMobile={() => { drawerClosed = true; }} />
        <ProvidersScreen />
      </StoreProvider>
    );
  });

  const distNavBtn = renderer.root.findAllByType('button').find((b) => textOf(b).trim() === 'Distribuidores');
  assert.ok(distNavBtn, 'Expected Distribuidores tab in sidebar drawer');
  await act(async () => {
    distNavBtn!.props.onClick();
  });
  assert.equal(provStore.activeScreen, 'providers');
  assert.equal(drawerClosed, true);

  // 2. Rename distributor from ProvidersScreen and confirm products reflect new distributor name
  const editProvBtn = renderer.root.findByProps({ 'aria-label': 'Editar distribuidor Distribuidora Alfa' });
  await act(async () => {
    editProvBtn.props.onClick({ stopPropagation() {} });
  });
  await act(async () => {
    renderer.root.findByProps({ 'aria-label': 'Nombre del distribuidor' }).props.onChange({
      target: { value: 'Distribuidora Alfa Renovada' }
    });
  });
  await act(async () => {
    await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} });
  });

  assert.equal(updatedProvPayload.id, 10);
  assert.equal(updatedProvPayload.payload.razon_social, 'Distribuidora Alfa Renovada');
  assert.equal(provStore.products[0].distributor, 'Distribuidora Alfa Renovada');

  // 3. Select distributor -> view product -> click Eliminar -> confirm root deletion
  const provCard = renderer.root.findAllByType('div').find(
    (d) => d.props.role === 'button' && textOf(d).includes('Distribuidora Alfa Renovada')
  );
  assert.ok(provCard, 'Expected distributor card with updated name');
  await act(async () => {
    provCard!.props.onClick();
  });

  const delBtn = renderer.root.findByProps({ 'aria-label': 'Eliminar producto Fideo Alfa 400g' });
  await act(async () => {
    delBtn.props.onClick();
  });
  const confirmDelBtn = renderer.root.findAllByType('button').find((b) => textOf(b).includes('Sí, eliminar de raíz'));
  assert.ok(confirmDelBtn, 'Expected confirmation button for permanent product deletion');
  await act(async () => {
    await confirmDelBtn!.props.onClick();
  });

  assert.equal(deletedProdId, 15);
  assert.equal(provStore.products.length, 0);

  // 4. InventoryScreen dropdown hides sort options ("Modo de Organización") on phone/tablet (< lg)
  await act(async () => {
    renderer.update(<StoreProvider><ProvProbe /><InventoryScreen /></StoreProvider>);
  });
  const menuBtn = renderer.root.findByProps({ title: 'Organizar por proveedor o alfabéticamente' });
  await act(async () => {
    menuBtn.props.onClick();
  });
  const sortContainer = renderer.root.findAllByType('div').find(
    (d) => typeof d.props.className === 'string' && d.props.className.includes('hidden lg:block') && textOf(d).includes('Organizar por Proveedor (A')
  );
  assert.ok(sortContainer, 'Expected Modo de Organización options to be wrapped with hidden lg:block for phone menu');
});

test('ProvidersScreen shows consequence warning alert before deleting distributor and removes all its products on confirm', async (t) => {
  (globalThis as any).document.addEventListener = () => {};
  (globalThis as any).document.removeEventListener = () => {};

  let deletedProviderId: number | null = null;
  t.mock.method(api, 'getProveedores', async () => [
    { id_proveedor: 10, ruc_ci: '1790001112001', razon_social: 'Distribuidora Borrable', telefono: '099111222' },
    { id_proveedor: 11, ruc_ci: '1790002223001', razon_social: 'Distribuidora Conservada', telefono: '099333444' }
  ]);
  t.mock.method(api, 'eliminarProveedor', async (id: number) => {
    deletedProviderId = id;
    return {
      success: true,
      deleted_products_permanently: 2,
      archived_products: 0,
      total_products_removed: 2,
      provider_deleted_permanently: true,
      message: 'Distribuidor eliminado junto con 2 producto(s) asociados'
    };
  });
  t.mock.method(api, 'getProductos', async () => [
    {
      ...createdProduct('Abarrotes', 1),
      id_producto: 21,
      codigo_interno: 'BOR-01',
      nombre: 'Galleta Borrable 1',
      stock_actual: 5,
      id_proveedor: 10,
      proveedor_nombre: 'Distribuidora Borrable'
    },
    {
      ...createdProduct('Abarrotes', 2),
      id_producto: 22,
      codigo_interno: 'BOR-02',
      nombre: 'Galleta Borrable 2',
      stock_actual: 3,
      id_proveedor: 10,
      proveedor_nombre: 'Distribuidora Borrable'
    },
    {
      ...createdProduct('Bebidas', 3),
      id_producto: 31,
      codigo_interno: 'CON-01',
      nombre: 'Jugo Conservado',
      stock_actual: 4,
      id_proveedor: 11,
      proveedor_nombre: 'Distribuidora Conservada'
    }
  ]);

  const textOf = (node: any): string =>
    typeof node === 'string' || typeof node === 'number'
      ? String(node)
      : Array.isArray(node?.children)
      ? node.children.map(textOf).join('')
      : '';

  let delStore!: StoreContextType;
  function DelProbe() { delStore = useStore(); return null; }

  await act(async () => {
    renderer.unmount();
  });
  await act(async () => {
    renderer = create(
      <StoreProvider>
        <DelProbe />
        <ProvidersScreen />
      </StoreProvider>
    );
  });

  // Add one owned product to cart so we verify cart cleanup too
  await act(async () => {
    delStore.addProductToCart(delStore.products.find((p) => p.id === '21')!);
  });
  assert.equal(delStore.cart.length, 1);
  assert.equal(delStore.products.length, 3);

  // 1. Clicking card trash opens warning alert dialog without deleting yet
  const cardDelBtn = renderer.root.findByProps({ 'aria-label': 'Eliminar distribuidor Distribuidora Borrable' });
  await act(async () => {
    cardDelBtn.props.onClick({ stopPropagation() {} });
  });

  const alertDialog = renderer.root.findByProps({ role: 'alertdialog' });
  const alertText = textOf(alertDialog);
  assert.ok(alertText.includes('¿Qué implica eliminar este distribuidor?'));
  assert.ok(alertText.includes('Se eliminarán todos los 2 productos asociados'));
  assert.equal(deletedProviderId, null);

  // 2. Canceling keeps distributor and all products untouched
  const cancelBtn = alertDialog.findAllByType('button').find((b) => textOf(b).trim() === 'Cancelar');
  assert.ok(cancelBtn);
  await act(async () => {
    cancelBtn!.props.onClick();
  });
  assert.equal(deletedProviderId, null);
  assert.equal(delStore.products.length, 3);

  // 3. Selecting distributor and clicking header "Eliminar Distribuidor" -> confirm deletes provider & all owned products
  const borrableCard = renderer.root.findAllByType('div').find(
    (d) => d.props.role === 'button' && textOf(d).includes('Distribuidora Borrable')
  );
  await act(async () => {
    borrableCard!.props.onClick();
  });
  const headerDelBtn = renderer.root.findByProps({ 'aria-label': 'Eliminar distribuidor seleccionado' });
  await act(async () => {
    headerDelBtn.props.onClick();
  });
  const confirmBtn = renderer.root
    .findByProps({ role: 'alertdialog' })
    .findAllByType('button')
    .find((b) => textOf(b).includes('Sí, eliminar distribuidor y productos'));
  assert.ok(confirmBtn);

  await act(async () => {
    await confirmBtn!.props.onClick();
  });

  assert.equal(deletedProviderId, 10);
  assert.deepEqual(
    delStore.products.map((p) => p.id),
    ['31']
  );
  assert.equal(delStore.cart.length, 0);
  assert.ok(!textOf(renderer.root).includes('Distribuidora Borrable'));
  assert.ok(textOf(renderer.root).includes('Distribuidora Conservada'));
});
