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
    renderer.root.findByType('select').props.onChange({ target: { value: 'Hogar' } });
  });
  await act(async () => { await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  assert.equal(store.isNewProductModalOpen, true);
  assert.equal(renderer.root.findByType('select').props.value, 'Hogar');
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
    renderer.root.findByType('select').props.onChange({ target: { value: 'Condimentos' } });
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
    renderer.root.findByType('select').props.onChange({ target: { value: 'Hogar' } });
  });
  await act(async () => { await renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  assert.equal(store.isAltaAlVueloOpen, true);
  assert.equal(store.unknownBarcode, 'NEW-BARCODE');
  assert.equal(renderer.root.findByType('select').props.value, 'Hogar');
  assert.equal(store.products.length, 1);
  assert.equal(store.cart.length, 1);
  assert.equal(renderer.root.findAllByType('button').find(n => n.props.type === 'submit')!.props.disabled, false);
});
