export type ScreenType = 'pos' | 'debtors' | 'inventory' | 'providers' | 'orders' | 'reception' | 'kardex' | 'reports' | 'settings';

export const STORE_CATEGORIES = [
  'Abarrotes',
  'Lácteos',
  'Bebidas',
  'Limpieza',
  'Snacks',
  'Panadería',
  'Embutidos',
  'Condimentos',
  'Hogar',
  'Frutas y Verduras',
] as const;

export type Category = (typeof STORE_CATEGORIES)[number] | (string & {});

export type OrderStatus = 'PENDIENTE' | 'RECIBIDO' | 'CANCELADO';

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  code: string;
  name: string;
  quantityOrdered: number;
  estimatedCost: number;
  subtotal: number;
  category?: string;
  barcode?: string;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  providerId?: number;
  providerName: string;
  date: string; // YYYY-MM-DD
  expectedDeliveryDate?: string;
  status: OrderStatus;
  items: PurchaseOrderItem[];
  totalUnits: number;
  totalAmount: number;
  notes?: string;
  receivedInvoiceNumber?: string;
  receivedDate?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: Category;
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  barcode?: string;
  distributor?: string;
  providerId?: number;
  unit?: string;
  description?: string;
  allowFraction?: boolean;
  lastUpdated?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  promoLabel?: string;
}

export type PaymentMethod = 'cash' | 'transfer' | 'mixed';

export interface ParkedCart {
  id: string;
  label: string;
  createdAt: string;
  items: CartItem[];
  discount: number;
}

export interface StoreConfig {
  storeName: string;
  ruc: string;
  address: string;
  phone: string;
  receiptFooter: string;
}

export interface SaleItem {
  productId: string;
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  sessionId?: number;
  ticketNumber: string;
  date: string; // ISO or formatted
  time: string;
  items: SaleItem[];
  subtotal: number;
  discount?: number;
  total?: number;
  totalArticles: number;
  totalUnits: number;
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  change?: number;
  cashAmount?: number;
  transferAmount?: number;
  status?: 'CONFIRMADA' | 'ANULADA';
  voidReason?: string;
  cashierName: string;
}

export type KardexType = 'INICIAL' | 'COMPRA' | 'VENTA' | 'VENTA MAYORISTA' | 'DAÑO' | 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO' | 'DEVOLUCION_CLIENTE' | 'DEVOLUCION';

export interface KardexMovement {
  id: string;
  productId: string;
  date: string;
  time: string;
  type: KardexType;
  docNumber: string;
  responsible: string;
  quantityChange: number; // + or -
  balance: number;
  notes?: string;
  costUnit?: number;
  salePriceUnit?: number;
}

export interface ReceptionDraftItem {
  id: string;
  code: string;
  name: string;
  quantityReceived: number;
  unitCost: number;
  previousCost: number;
  salePrice: number;
  suggestedSalePrice?: number;
  isNewProduct?: boolean;
}

export interface ReceptionInvoice {
  id: string;
  providerId: number;
  provider: string;
  invoiceNumber: string;
  date: string;
  items: ReceptionDraftItem[];
  totalUnits: number;
  totalAmount: number;
}

export interface CashMovement {
  id: string;
  time: string;
  date: string;
  type: 'VENTA' | 'RETIRO' | 'INGRESO';
  description: string;
  amount: number;
  ticketRef?: string;
}

export interface CashShift {
  sessionId?: number;
  isOpen: boolean;
  openedAt: string;
  cashierName: string;
  initialCash: number;
  cashSalesTotal: number;
  transferSalesTotal: number;
  withdrawalsTotal: number;
  depositsTotal: number;
  expectedCash: number;
  countedCash: number;
  movements: CashMovement[];
}

export interface Worker {
  id: number;
  name: string;
  username: string;
  role: string;
  active: boolean;
  createdAt?: string;
  canLogin?: boolean;
}

export interface AuthUser {
  id_usuario: number;
  username: string;
  nombre_completo: string;
  id_role: number;
  role_name: string;
  debe_cambiar_clave?: boolean;
}

export type DebtorType = 'MONTO' | 'PRODUCTOS';
export type DebtorStatus = 'PENDIENTE' | 'PAGADO';

export interface DebtorItem {
  id: string;
  productId?: number | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  recordedAt: string;
}

export interface DebtorPayment {
  id: string;
  amount: number;
  paymentMethod: 'EFECTIVO' | 'TRANSFERENCIA';
  note?: string;
  recordedInCash: boolean;
  cashMovementId?: number | null;
  dateTime: string;
}

export interface DebtorAccount {
  id: number;
  personName: string;
  phone?: string;
  debtType: DebtorType;
  totalDebt: number;
  totalPaid: number;
  balanceDue: number;
  status: DebtorStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  items: DebtorItem[];
  payments: DebtorPayment[];
}

