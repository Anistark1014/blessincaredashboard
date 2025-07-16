// Mock data for the healthcare system

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  availability: 'in-stock' | 'low-stock' | 'out-of-stock';
  image: string;
}

export interface ProductRequest {
  id: string;
  resellerId: string;
  resellerName: string;
  products: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }[];
  totalAmount: number;
  status: 'pending' | 'approved' | 'in-production' | 'shipped' | 'delivered';
  requestDate: string;
  specialInstructions?: string;
  paymentStatus: 'pending' | 'partial' | 'paid';
  paidAmount: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'payment' | 'request' | 'product' | 'alert';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

export interface Expense {
  id: string;
  date: string;
  category: 'production' | 'shipping' | 'labor' | 'marketing' | 'overhead';
  amount: number;
  description: string;
  type: 'fixed' | 'variable';
}

export const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Women\'s Multivitamin Plus',
    description: 'Complete daily nutrition support with iron, folate, and calcium',
    price: 29.99,
    category: 'Supplements',
    availability: 'in-stock',
    image: '/api/placeholder/300/200'
  },
  {
    id: '2',
    name: 'Prenatal Care Bundle',
    description: 'Essential vitamins and nutrients for expecting mothers',
    price: 45.99,
    category: 'Prenatal',
    availability: 'in-stock',
    image: '/api/placeholder/300/200'
  },
  {
    id: '3',
    name: 'Hormonal Balance Support',
    description: 'Natural supplement for hormonal wellness and balance',
    price: 34.99,
    category: 'Wellness',
    availability: 'low-stock',
    image: '/api/placeholder/300/200'
  },
  {
    id: '4',
    name: 'Calcium + Vitamin D3',
    description: 'Bone health support specifically formulated for women',
    price: 24.99,
    category: 'Supplements',
    availability: 'in-stock',
    image: '/api/placeholder/300/200'
  },
  {
    id: '5',
    name: 'Iron Boost Complex',
    description: 'Gentle iron supplement with enhanced absorption',
    price: 19.99,
    category: 'Supplements',
    availability: 'out-of-stock',
    image: '/api/placeholder/300/200'
  },
  {
    id: '6',
    name: 'Omega-3 Women\'s Health',
    description: 'Premium fish oil for heart and brain health',
    price: 39.99,
    category: 'Supplements',
    availability: 'in-stock',
    image: '/api/placeholder/300/200'
  }
];

export const mockRequests: ProductRequest[] = [
  {
    id: 'REQ001',
    resellerId: '1',
    resellerName: 'Sarah Johnson',
    products: [
      { productId: '1', productName: 'Women\'s Multivitamin Plus', quantity: 50, price: 29.99 },
      { productId: '2', productName: 'Prenatal Care Bundle', quantity: 30, price: 45.99 }
    ],
    totalAmount: 2877.20,
    status: 'delivered',
    requestDate: '2024-01-15',
    paymentStatus: 'partial',
    paidAmount: 1500.00,
    specialInstructions: 'Please ensure temperature-controlled shipping'
  },
  {
    id: 'REQ002',
    resellerId: '1',
    resellerName: 'Sarah Johnson',
    products: [
      { productId: '3', productName: 'Hormonal Balance Support', quantity: 25, price: 34.99 }
    ],
    totalAmount: 874.75,
    status: 'approved',
    requestDate: '2024-01-20',
    paymentStatus: 'pending',
    paidAmount: 0
  },
  {
    id: 'REQ003',
    resellerId: '2',
    resellerName: 'Maria Rodriguez',
    products: [
      { productId: '4', productName: 'Calcium + Vitamin D3', quantity: 100, price: 24.99 },
      { productId: '6', productName: 'Omega-3 Women\'s Health', quantity: 40, price: 39.99 }
    ],
    totalAmount: 4098.60,
    status: 'shipped',
    requestDate: '2024-01-18',
    paymentStatus: 'paid',
    paidAmount: 4098.60
  }
];

export const mockNotifications: Notification[] = [
  {
    id: 'N001',
    userId: '1',
    type: 'payment',
    title: 'Payment Reminder',
    message: 'Outstanding payment of $1,377.20 for Request #REQ001',
    timestamp: '2024-01-22T10:30:00Z',
    read: false,
    actionUrl: '/reseller/payments'
  },
  {
    id: 'N002',
    userId: '1',
    type: 'request',
    title: 'Request Approved',
    message: 'Your request #REQ002 has been approved and is entering production',
    timestamp: '2024-01-21T14:15:00Z',
    read: false
  },
  {
    id: 'N003',
    userId: '1',
    type: 'product',
    title: 'New Product Available',
    message: 'Iron Boost Complex is back in stock',
    timestamp: '2024-01-20T09:00:00Z',
    read: true
  },
  {
    id: 'N004',
    userId: '2',
    type: 'alert',
    title: 'Low Stock Alert',
    message: 'Hormonal Balance Support is running low on inventory',
    timestamp: '2024-01-22T08:45:00Z',
    read: false
  }
];

export const mockExpenses: Expense[] = [
  {
    id: 'E001',
    date: '2024-01-22',
    category: 'production',
    amount: 5000.00,
    description: 'Raw materials for Q1 production batch',
    type: 'variable'
  },
  {
    id: 'E002',
    date: '2024-01-20',
    category: 'shipping',
    amount: 1200.00,
    description: 'FedEx shipping costs for January deliveries',
    type: 'variable'
  },
  {
    id: 'E003',
    date: '2024-01-15',
    category: 'labor',
    amount: 8000.00,
    description: 'Monthly production staff salaries',
    type: 'fixed'
  },
  {
    id: 'E004',
    date: '2024-01-10',
    category: 'marketing',
    amount: 2500.00,
    description: 'Digital marketing campaign for new products',
    type: 'variable'
  },
  {
    id: 'E005',
    date: '2024-01-01',
    category: 'overhead',
    amount: 3500.00,
    description: 'Monthly facility rent and utilities',
    type: 'fixed'
  }
];

// Helper functions
export const getProductById = (id: string): Product | undefined => {
  return mockProducts.find(product => product.id === id);
};

export const getRequestsByReseller = (resellerId: string): ProductRequest[] => {
  return mockRequests.filter(request => request.resellerId === resellerId);
};

export const getNotificationsByUser = (userId: string): Notification[] => {
  return mockNotifications.filter(notification => notification.userId === userId);
};

export const getUnreadNotificationCount = (userId: string): number => {
  return mockNotifications.filter(notification => 
    notification.userId === userId && !notification.read
  ).length;
};

export const calculateTotalRevenue = (): number => {
  return mockRequests.reduce((total, request) => total + request.paidAmount, 0);
};

export const calculateTotalExpenses = (): number => {
  return mockExpenses.reduce((total, expense) => total + expense.amount, 0);
};