import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Heart,
  LogOut,
  Bell,
  Home,
  Package,
  ShoppingCart,
  CreditCard,
  Users,
  BarChart3,
  Settings,
  Flower2,
  DollarSign,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Wallet
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import ToggleTheme from './ToggleTheme';

interface LayoutProps {
  children: React.ReactNode;
}

// Cash Balance Hook - Replace with actual Supabase implementation
const useCashBalance = () => {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    setLoading(true);
    // Simulate API call - Replace with actual Supabase query
    setTimeout(() => {
      setBalance({
        availableCashBalance: 8561579,
        totalInflow: 573070,
        totalOutflow: 1011491,
        salesRevenue: 173070,
        investmentsReceived: 400000,
        expensesPaid: 164530,
        loanRepayments: 1120,
        inventoryPurchases: 845841,
        netCashFlow: 573070 - 1011491
      });
      setLoading(false);
    }, 1000);
  };
  
  return { balance, loading, refetch: fetchBalance };
};

// Cash Balance Component for Navbar
const CashBalanceNavbar = () => {
  const { balance, loading, refetch } = useCashBalance();
  
  const formatCompactCurrency = (amount) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(1)}Cr`;
    } else if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    } else if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(1)}K`;
    }
    return `₹${amount}`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-card/50 rounded-lg border border-lavender/20">
        <Wallet className="w-4 h-4 text-muted-foreground" />
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Cash Balance</span>
          <div className="w-16 h-3 bg-muted rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  const isPositive = balance?.availableCashBalance >= 0;
  const isNetPositive = balance?.netCashFlow >= 0;

  return (
    <div className="flex items-center gap-2">
      {/* Main Cash Balance Display */}
      <div className="flex items-center gap-2 px-3 py-2 bg-card/50 rounded-lg border border-lavender/20 backdrop-blur-sm">
        <Wallet className={`w-4 h-4 ${isPositive ? 'text-green-500' : 'text-red-500'}`} />
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Available Cash</span>
          <span className={`text-sm font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {formatCompactCurrency(balance?.availableCashBalance || 0)}
          </span>
        </div>
        <button
          onClick={refetch}
          className="ml-1 p-1 hover:bg-muted rounded transition-colors"
          title="Refresh balance"
        >
          <RefreshCw className="w-3 h-3 text-muted-foreground hover:text-foreground" />
        </button>
      </div>

      {/* Quick Summary Tooltip/Dropdown */}
      <div className="relative group hidden lg:block">
        <button className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <span>Details</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {/* Dropdown Content */}
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-lavender/20 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 backdrop-blur-sm">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Cash Flow Summary</h3>
            
            <div className="space-y-2">
              {/* Inflows */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-muted-foreground">Sales Revenue</span>
                </div>
                <span className="text-xs text-green-600">
                  +{formatCurrency(balance?.salesRevenue || 0)}
                </span>
              </div>
              
              {balance?.investmentsReceived > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                    <span className="text-xs text-muted-foreground">Investments</span>
                  </div>
                  <span className="text-xs text-green-600">
                    +{formatCurrency(balance.investmentsReceived)}
                  </span>
                </div>
              )}

              <hr className="border-lavender/20" />

              {/* Outflows */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-3 h-3 text-red-500" />
                  <span className="text-xs text-muted-foreground">Operating Expenses</span>
                </div>
                <span className="text-xs text-red-600">
                  -{formatCurrency(balance?.expensesPaid || 0)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-3 h-3 text-red-500" />
                  <span className="text-xs text-muted-foreground">Inventory Purchases</span>
                </div>
                <span className="text-xs text-red-600">
                  -{formatCurrency(balance?.inventoryPurchases || 0)}
                </span>
              </div>

              <hr className="border-lavender/20" />

              {/* Net Flow */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-semibold text-foreground">Net Cash Flow</span>
                <span className={`text-xs font-semibold ${isNetPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {isNetPositive ? '+' : ''}
                  {formatCurrency(balance?.netCashFlow || 0)}
                </span>
              </div>
            </div>

            {/* View Full Report Link */}
            <div className="mt-3 pt-3 border-t border-lavender/20">
              <NavLink 
                to="/admin/cash-balance" 
                className="text-xs text-primary hover:text-primary/80 font-medium"
              >
                View Full Cash Balance Report →
              </NavLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const resellerNavItems = [
    { to: '/reseller', icon: Home, label: 'Dashboard' },
    { to: '/reseller/catalog', icon: Package, label: 'Product Catalog' },
    { to: '/reseller/requests', icon: ShoppingCart, label: 'My Requests' },
    { to: '/reseller/payments', icon: CreditCard, label: 'Payments' },
  ];

  const adminNavItems = [
    { to: '/admin', icon: Home, label: 'Dashboard' },
    { to: '/admin/products', icon: Package, label: 'Product Management' },
    { to: '/admin/resellers', icon: Users, label: 'Reseller Management' },
    { to: '/admin/sales', icon: BarChart3, label: 'Sales Tracking' },
    { to: '/admin/expenses', icon: Settings, label: 'Expense Tracker' },
    { to: '/admin/inventory', icon: Users, label: 'Inventory Management' },
    { to: '/admin/finance', icon: IndianRupee, label: 'Finance Management' },
    { to: '/admin/cash-balance', icon: Wallet, label: 'Cash Balance' },
    { to: '/admin/GrossProfitAnalysis', icon: IndianRupee, label: 'GrossProfitAnalysis' },
  ];

  const navItems = user?.role === 'admin' ? adminNavItems : resellerNavItems;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-lavender/5 to-blush/5">
      {/* Top Navigation */}
      <nav className="bg-card/80 backdrop-blur-sm border-b border-lavender/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo + Hamburger */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className=""
                onClick={() => setSidebarOpen(!isSidebarOpen)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={
                      isSidebarOpen
                        ? 'M6 18L18 6M6 6l12 12' // X icon
                        : 'M4 6h16M4 12h16M4 18h16' // Hamburger
                    }
                  />
                </svg>
              </Button>

              <div className="w-10 h-10 bg-gradient-to-br from-lavender to-blush rounded-full flex items-center justify-center shadow-[var(--shadow-soft)]">
                <Heart className="w-5 h-5 text-lavender-foreground" />
              </div>
              <div>
                <h1 className="text-sm md:text-lg font-semibold text-foreground">Blessin Care</h1>
                <p className="text-xs text-muted-foreground capitalize">{user?.role} Portal</p>
              </div>
            </div>

            {/* Middle Section - Cash Balance (only for admin) */}
            <div className="flex-1 flex justify-center">
              {user?.role === 'admin' && (
                <CashBalanceNavbar />
              )}
            </div>

            {/* User Actions */}
            <div className="flex items-center gap-4">
              <ToggleTheme />
              <Button variant="ghost" size="sm" className="relative hidden md:inline">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-blush rounded-full pulse-soft"></span>
              </Button>
              <div className="items-center gap-3 hidden md:flex">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-foreground">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <div className="w-8 h-8 bg-gradient-to-br from-mint to-mint-dark rounded-full flex items-center justify-center">
                  <Flower2 className="w-4 h-4 text-mint-foreground" />
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col gap-6">
          {/* Sidebar Navigation (Drawer style on all screens) */}
          <aside
            className={`
              fixed top-0 left-0 bottom-0 z-50 w-64 bg-background border-r border-lavender/10 shadow-lg
              p-4 overflow-y-auto transform transition-transform duration-300
              ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}
          >
            <div className="healthcare-card p-4">
              <nav className="space-y-2">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.to;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-lavender to-blush text-lavender-foreground shadow-[var(--shadow-soft)]'
                          : 'text-muted-foreground hover:text-foreground hover:bg-lavender/10'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;