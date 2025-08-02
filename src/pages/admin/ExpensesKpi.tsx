import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Wallet, ShoppingCart, TrendingUp, Users, Zap, Truck, 
  Plane, Receipt, Building, FileText, CreditCard, DollarSign, Package
} from 'lucide-react';

// --- INTERFACES ---
interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
}

interface ExpenseKPICardsProps {
  expenses: Expense[];
}

// --- CONSTANTS ---
const expenseCategories = [
  'Stock Purchase', 
  'Marketing', 
  'Salaries', 
  'Utilities & Subscriptions', 
  'Logistics', 
  'Travel Allowance', 
  'Tax Expense', 
  'Other Business Expense'
];

const categoryIcons = {
  'Stock Purchase': ShoppingCart,
  'Marketing': TrendingUp,
  'Salaries': Users,
  'Utilities & Subscriptions': Zap,
  'Logistics': Truck,
  'Travel Allowance': Plane,
  'Tax Expense': Receipt,
  'Other Business Expense': Building,
};

// --- HELPER FUNCTIONS ---
const formatCurrency = (amount: number) => 
  new Intl.NumberFormat('en-IN', { 
    style: 'currency', 
    currency: 'INR' 
  }).format(amount);

const formatCompactCurrency = (amount: number) => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(2)}K`;
  return `₹${amount.toFixed(2)}`;
};

// --- MAIN COMPONENT ---
const ExpenseKPICards: React.FC<ExpenseKPICardsProps> = ({ expenses }) => {
  // Sample data for demonstration
  const sampleExpenses = [
    { id: '1', date: '2025-01-15', category: 'Stock Purchase', description: 'Inventory Purchase', amount: 0 },
    { id: '2', date: '2025-01-16', category: 'Marketing', description: 'Digital Ads', amount: 0 },
    { id: '3', date: '2025-01-17', category: 'Salaries', description: 'Monthly Payroll', amount: 0 },
    { id: '4', date: '2025-01-18', category: 'Utilities & Subscriptions', description: 'Office Utilities', amount: 0 },
    { id: '5', date: '2025-01-19', category: 'Logistics', description: 'Shipping Costs', amount: 0 },
    { id: '6', date: '2025-01-20', category: 'Travel Allowance', description: 'Business Trip', amount: 0 },
    { id: '7', date: '2025-01-21', category: 'Tax Expense', description: 'GST Payment', amount: 0 },
    { id: '8', date: '2025-01-22', category: 'Other Business Expense', description: 'Office Supplies', amount: 0 }
  ];

  const displayExpenses = expenses.length > 0 ? expenses : sampleExpenses;
  
  const stats = useMemo(() => {
    const total = displayExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
    const count = displayExpenses.length;
    
    // Category-wise breakdown
    const categoryStats = expenseCategories.map(category => {
      const categoryExpenses = displayExpenses.filter(exp => exp.category === category);
      const categoryTotal = categoryExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
      const categoryCount = categoryExpenses.length;
      
      return {
        category,
        total: categoryTotal,
        count: categoryCount,
        icon: categoryIcons[category as keyof typeof categoryIcons] || Building,
      };
    }).filter(stat => stat.total > 0).sort((a, b) => b.total - a.total);

    const avgPerTransaction = count > 0 ? total / count : 0;
    const highestExpense = Math.max(...displayExpenses.map(e => e.amount));

    return {
      total,
      count,
      average: avgPerTransaction,
      categoryStats,
      highestExpense
    };
  }, [displayExpenses]);

  return (
      <div className="max-w-7xl mx-auto">
        
        {/* Main KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          
          {/* Total Expenses */}
          <Card className=" border-slate-700 hover:bg-slate-750 transition-colors duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-400 text-sm font-medium">Total Expenses</h3>
                <FileText className="h-5 w-5 text-slate-500" />
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-white">
                  {formatCompactCurrency(stats.total)}
                </p>
                <p className="text-slate-400 text-sm">
                  From {stats.count} expenses
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Average Expense */}
          <Card className=" border-slate-700 hover:bg-slate-750 transition-colors duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-400 text-sm font-medium">Average Expense</h3>
                <CreditCard className="h-5 w-5 text-slate-500" />
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-green-400">
                  {formatCompactCurrency(stats.average)}
                </p>
                <p className="text-slate-400 text-sm">
                  Per transaction
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Highest Single Expense */}
          <Card className=" border-slate-700 hover:bg-slate-750 transition-colors duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-400 text-sm font-medium">Highest Expense</h3>
                <DollarSign className="h-5 w-5 text-slate-500" />
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-red-400">
                  {formatCompactCurrency(stats.highestExpense)}
                </p>
                <p className="text-slate-400 text-sm">
                  Single transaction
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Active Categories */}
          <Card className=" border-slate-700 hover:bg-slate-750 transition-colors duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-400 text-sm font-medium">Active Categories</h3>
                <Package className="h-5 w-5 text-slate-500" />
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold text-blue-400">
                  {stats.categoryStats.length}
                </p>
                <p className="text-slate-400 text-sm">
                  Expense categories
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category Breakdown */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Category Breakdown</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.categoryStats.map((stat) => {
              const IconComponent = stat.icon;
              
              return (
                <Card key={stat.category} className=" border-slate-700 hover:bg-slate-750 transition-colors duration-200">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="bg-slate-700 p-2 rounded-lg">
                        <IconComponent className="h-4 w-4 text-slate-300" />
                      </div>
                      <h3 className="text-slate-300 text-sm font-medium truncate flex-1">
                        {stat.category}
                      </h3>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-xl font-bold text-white">
                        {formatCompactCurrency(stat.total)}
                      </p>
                      <p className="text-slate-400 text-xs">
                        {stat.count} transaction{stat.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
  );
};

export default ExpenseKPICards;