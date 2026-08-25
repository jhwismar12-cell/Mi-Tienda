import { Product, KardexMovement, CashShift, CashMovement, Sale } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    code: '78610001',
    name: 'Pan Bimbo Blanco Grande',
    category: 'Panadería',
    costPrice: 1.85,
    salePrice: 2.50,
    stock: 14,
    minStock: 5,
    barcode: '78610001',
    unit: 'Funda'
  },
  {
    id: 'prod-2',
    code: '78610223',
    name: 'Leche Vita Entera 1L',
    category: 'Lácteos',
    costPrice: 0.75,
    salePrice: 0.95,
    stock: 24,
    minStock: 8,
    barcode: '78610223',
    unit: 'Funda'
  },
  {
    id: 'prod-3',
    code: '00000004',
    name: 'Pan de Agua (Unidad)',
    category: 'Panadería',
    costPrice: 0.10,
    salePrice: 0.15,
    stock: 65,
    minStock: 20,
    barcode: '00000004',
    unit: 'Unidad'
  },
  {
    id: 'prod-4',
    code: '78610002',
    name: 'Huevos de Granja (Unidad)',
    category: 'Abarrotes',
    costPrice: 0.12,
    salePrice: 0.18,
    stock: 90,
    minStock: 30,
    barcode: '78610002',
    unit: 'Unidad'
  },
  {
    id: 'prod-5',
    code: '78610003',
    name: 'Queso Manaba Semiduro (lb)',
    category: 'Lácteos',
    costPrice: 2.10,
    salePrice: 2.80,
    stock: 12,
    minStock: 4,
    barcode: '78610003',
    unit: 'Libra'
  },
  {
    id: 'prod-6',
    code: '00000099',
    name: 'Recarga Celular Electrónica',
    category: 'Abarrotes',
    costPrice: 0.95,
    salePrice: 1.00,
    stock: 999,
    minStock: 50,
    barcode: '00000099',
    unit: 'Servicio'
  },
  {
    id: 'prod-7',
    code: '770123456',
    name: 'Aceite Girasol Fino 1L',
    category: 'Abarrotes',
    costPrice: 3.40,
    salePrice: 4.50,
    stock: 48,
    minStock: 10,
    barcode: '770123456',
    unit: 'Botella'
  },
  {
    id: 'prod-8',
    code: '770987654',
    name: 'Leche Entera Larga Vida 1L',
    category: 'Lácteos',
    costPrice: 0.90,
    salePrice: 1.20,
    stock: 2,
    minStock: 5,
    barcode: '770987654',
    unit: 'Tetrapack'
  },
  {
    id: 'prod-9',
    code: '770456123',
    name: 'Arroz Extra Fino 1kg',
    category: 'Abarrotes',
    costPrice: 1.35,
    salePrice: 1.80,
    stock: 0,
    minStock: 10,
    barcode: '770456123',
    unit: 'Funda'
  },
  {
    id: 'prod-10',
    code: '770112233',
    name: 'Detergente Polvo 2kg',
    category: 'Limpieza',
    costPrice: 6.80,
    salePrice: 8.50,
    stock: 12,
    minStock: 4,
    barcode: '770112233',
    unit: 'Funda'
  },
  {
    id: 'prod-11',
    code: '7702004001234',
    name: 'Arroz Blanco Superior 1kg',
    category: 'Abarrotes',
    costPrice: 3.20,
    salePrice: 4.50,
    stock: 50,
    minStock: 15,
    barcode: '7702004001234',
    unit: 'Funda'
  },
  {
    id: 'prod-12',
    code: '7703344556677',
    name: 'Aceite Vegetal Girasol 1L',
    category: 'Abarrotes',
    costPrice: 8.50,
    salePrice: 9.50,
    stock: 24,
    minStock: 8,
    barcode: '7703344556677',
    unit: 'Botella'
  },
  {
    id: 'prod-13',
    code: '7701122334455',
    name: 'Frijol Cargamanto 500g',
    category: 'Abarrotes',
    costPrice: 4.10,
    salePrice: 5.80,
    stock: 100,
    minStock: 20,
    barcode: '7701122334455',
    unit: 'Funda'
  },
  {
    id: 'prod-14',
    code: '78610005',
    name: 'Atún en Aceite Real 140g',
    category: 'Abarrotes',
    costPrice: 1.05,
    salePrice: 1.40,
    stock: 36,
    minStock: 12,
    barcode: '78610005',
    unit: 'Lata'
  },
  {
    id: 'prod-15',
    code: '78610006',
    name: 'Gaseosa Coca-Cola 3L Retornable',
    category: 'Bebidas',
    costPrice: 2.15,
    salePrice: 2.75,
    stock: 18,
    minStock: 6,
    barcode: '78610006',
    unit: 'Botella'
  },
  {
    id: 'prod-16',
    code: '78610007',
    name: 'Galletas Amor Vainilla/Chocolate',
    category: 'Snacks',
    costPrice: 0.42,
    salePrice: 0.60,
    stock: 45,
    minStock: 15,
    barcode: '78610007',
    unit: 'Paquete'
  },
  {
    id: 'prod-17',
    code: '78610008',
    name: 'Jabón Protex Avena 110g',
    category: 'Limpieza',
    costPrice: 0.85,
    salePrice: 1.15,
    stock: 28,
    minStock: 8,
    barcode: '78610008',
    unit: 'Barra'
  },
  {
    id: 'prod-18',
    code: '78610009',
    name: 'Papel Higiénico Familia 4 Rollos',
    category: 'Limpieza',
    costPrice: 1.65,
    salePrice: 2.20,
    stock: 16,
    minStock: 5,
    barcode: '78610009',
    unit: 'Paquete'
  },
  {
    id: 'prod-19',
    code: '78610010',
    name: 'Azúcar Blanco San Carlos 1kg',
    category: 'Abarrotes',
    costPrice: 0.82,
    salePrice: 1.10,
    stock: 40,
    minStock: 10,
    barcode: '78610010',
    unit: 'Funda'
  }
];

export const INITIAL_KARDEX: KardexMovement[] = [
  {
    id: 'k-1',
    productId: 'prod-8', // Leche Entera Larga Vida 1L
    date: '01 Oct',
    time: '08:00',
    type: 'INICIAL',
    docNumber: 'AP-001',
    responsible: 'Admin',
    quantityChange: 0,
    balance: 0,
    costUnit: 0.90,
    notes: 'Apertura de inventario inicial'
  },
  {
    id: 'k-2',
    productId: 'prod-8',
    date: '05 Oct',
    time: '14:30',
    type: 'COMPRA',
    docNumber: 'FAC-9823',
    responsible: 'Wismar',
    quantityChange: 30,
    balance: 30,
    costUnit: 0.90,
    notes: 'Ingreso según factura de Distribuidora Andina'
  },
  {
    id: 'k-3',
    productId: 'prod-8',
    date: '06 Oct',
    time: '09:15',
    type: 'VENTA',
    docNumber: 'TK-4451',
    responsible: 'Ana L.',
    quantityChange: -2,
    balance: 28,
    costUnit: 0.90
  },
  {
    id: 'k-4',
    productId: 'prod-8',
    date: '07 Oct',
    time: '11:00',
    type: 'DAÑO',
    docNumber: 'MER-012',
    responsible: 'Supervisor',
    quantityChange: -1,
    balance: 27,
    costUnit: 0.90,
    notes: 'Empaque roto en bodega'
  },
  {
    id: 'k-5',
    productId: 'prod-8',
    date: '10 Oct',
    time: '18:40',
    type: 'VENTA',
    docNumber: 'TK-4480',
    responsible: 'Wismar',
    quantityChange: -15,
    balance: 12,
    costUnit: 0.90
  },
  {
    id: 'k-6',
    productId: 'prod-8',
    date: 'Hoy',
    time: '10:20',
    type: 'VENTA MAYORISTA',
    docNumber: 'FAC-9901',
    responsible: 'Wismar',
    quantityChange: -10,
    balance: 2,
    costUnit: 0.90,
    notes: 'Venta para cafetería vecina'
  },
  // Aceite Girasol Fino 1L Kardex
  {
    id: 'k-7',
    productId: 'prod-7',
    date: '01 Oct',
    time: '08:00',
    type: 'INICIAL',
    docNumber: 'AP-001',
    responsible: 'Admin',
    quantityChange: 50,
    balance: 50,
    costUnit: 3.40
  },
  {
    id: 'k-8',
    productId: 'prod-7',
    date: 'Hoy',
    time: '11:30',
    type: 'VENTA',
    docNumber: 'TK-4091',
    responsible: 'Wismar',
    quantityChange: -2,
    balance: 48,
    costUnit: 3.40
  }
];

export const INITIAL_MOVEMENTS: CashMovement[] = [
  {
    id: 'mov-1',
    time: '14:22',
    date: 'Hoy',
    type: 'VENTA',
    description: 'Venta - Ticket #4092',
    amount: 12.50,
    ticketRef: 'TK-4092'
  },
  {
    id: 'mov-2',
    time: '14:15',
    date: 'Hoy',
    type: 'RETIRO',
    description: 'Retiro - Pago Proveedor (Pan)',
    amount: -10.00
  },
  {
    id: 'mov-3',
    time: '14:05',
    date: 'Hoy',
    type: 'VENTA',
    description: 'Venta - Ticket #4091',
    amount: 4.25,
    ticketRef: 'TK-4091'
  },
  {
    id: 'mov-4',
    time: '12:30',
    date: 'Hoy',
    type: 'VENTA',
    description: 'Venta - Ticket #4085',
    amount: 18.20,
    ticketRef: 'TK-4085'
  }
];

export const INITIAL_SALES: Sale[] = [
  {
    id: 'sale-1',
    ticketNumber: 'TK-4092',
    date: '2026-08-25',
    time: '14:22:15',
    items: [
      { productId: 'prod-10', code: '770112233', name: 'Detergente Polvo 2kg', quantity: 1, unitPrice: 8.50, costPrice: 6.80, subtotal: 8.50 },
      { productId: 'prod-7', code: '770123456', name: 'Aceite Girasol Fino 1L', quantity: 1, unitPrice: 4.00, costPrice: 3.40, subtotal: 4.00 }
    ],
    subtotal: 12.50,
    totalArticles: 2,
    totalUnits: 2,
    paymentMethod: 'cash',
    cashReceived: 20.00,
    change: 7.50,
    cashierName: 'Wismar'
  },
  {
    id: 'sale-2',
    ticketNumber: 'TK-4091',
    date: '2026-08-25',
    time: '14:05:10',
    items: [
      { productId: 'prod-1', code: '78610001', name: 'Pan Bimbo Blanco Grande', quantity: 1, unitPrice: 2.50, costPrice: 1.85, subtotal: 2.50 },
      { productId: 'prod-2', code: '78610223', name: 'Leche Vita Entera 1L', quantity: 1, unitPrice: 0.95, costPrice: 0.75, subtotal: 0.95 },
      { productId: 'prod-4', code: '78610002', name: 'Huevos de Granja (Unidad)', quantity: 4, unitPrice: 0.20, costPrice: 0.12, subtotal: 0.80 }
    ],
    subtotal: 4.25,
    totalArticles: 3,
    totalUnits: 6,
    paymentMethod: 'cash',
    cashReceived: 5.00,
    change: 0.75,
    cashierName: 'Wismar'
  }
];

export const INITIAL_SHIFT: CashShift = {
  isOpen: true,
  openedAt: '08:00',
  cashierName: 'Wismar',
  initialCash: 20.00,
  cashSalesTotal: 342.50,
  transferSalesTotal: 78.40,
  withdrawalsTotal: 10.00,
  depositsTotal: 0,
  expectedCash: 352.50,
  countedCash: 352.50,
  movements: INITIAL_MOVEMENTS
};
