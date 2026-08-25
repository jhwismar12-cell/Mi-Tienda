export type ScreenType = 'pos' | 'inventory' | 'reception' | 'kardex' | 'reports' | 'settings';

export type Category = 'Abarrotes' | 'Lácteos' | 'Bebidas' | 'Limpieza' | 'Snacks' | 'Panadería' | 'Embutidos';

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
  unit?: string;
  lastUpdated?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export type PaymentMethod = 'cash' | 'transfer';

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
  ticketNumber: string;
  date: string; // ISO or formatted
  time: string;
  items: SaleItem[];
  subtotal: number;
  totalArticles: number;
  totalUnits: number;
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  change?: number;
  cashierName: string;
}

export type KardexType = 'INICIAL' | 'COMPRA' | 'VENTA' | 'VENTA MAYORISTA' | 'DAÑO' | 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO';

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
