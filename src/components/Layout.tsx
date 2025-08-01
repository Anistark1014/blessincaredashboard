import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase'; // Your database types
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
  Wallet,
  Award
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import ToggleTheme from './ToggleTheme';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  to: string;
  label: string;
  icon?: React.ComponentType<any>; // optional if you're using icons
}

// Initialize Supabase client - Fix for browser environment
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = createClient<Database>(supabaseUrl!, supabaseAnonKey!);

interface CashBalanceData {
  availableCashBalance: number;
  totalInflow: number;
  totalOutflow: number;
  salesRevenue: number;
  investmentsReceived: number;
  capitalInjected: number;
  expensesPaid: number;
  loanRepayments: number;
  goodsPurchases: number;
  capitalWithdrawals: number;
  netCashFlow: number;
}

// Enhanced Cash Balance Hook with Real Supabase Integration
const useCashBalance = () => {
  // const [balance, setBalance] = useState<any>(null);
  const [balance, setBalance] = useState<CashBalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch all required data in parallel
      const [
        salesData,
        investmentsData,
        capitalTransactionsData,
        expensesData,
        loanPaymentsData,
        goodsPurchasesData
      ] = await Promise.all([
        // Sales revenue (paid amounts)
        supabase
          .from('sales')
          .select('paid'),
        
        // Investments received
        supabase
          .from('investments')
          .select('amount'),
        
        // Capital transactions (starting balance + injections - withdrawals)
        supabase
          .from('cash_transactions')
          .select('transaction_type, amount'),
        
        // Operating expenses
        supabase
          .from('expenses')
          .select('amount'),
        
        // Loan repayments
        supabase
          .from('loan_payments')
          .select('amount'),
        
        // Goods purchases (COGS)
        supabase
          .from('goods_purchases')
          .select('amount')
          .eq('payment_status', 'paid')
      ]);

      // Check for errors
      if (salesData.error) throw salesData.error;
      if (investmentsData.error) throw investmentsData.error;
      if (capitalTransactionsData.error) throw capitalTransactionsData.error;
      if (expensesData.error) throw expensesData.error;
      if (loanPaymentsData.error) throw loanPaymentsData.error;
      if (goodsPurchasesData.error) throw goodsPurchasesData.error;

      // Calculate totals
      const salesRevenue = salesData.data?.reduce((sum, sale) => sum + (sale.paid || 0), 0) || 0;
      const investmentsReceived = investmentsData.data?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;
      
      // Calculate capital transactions
      let capitalInjected = 0;
      let capitalWithdrawals = 0;
      let startingBalance = 0;
      
      capitalTransactionsData.data?.forEach(transaction => {
        if (transaction.transaction_type === 'starting_balance' || transaction.transaction_type === 'capital_injection') {
          if (transaction.transaction_type === 'starting_balance') {
            startingBalance += transaction.amount;
          } else {
            capitalInjected += transaction.amount;
          }
        } else if (transaction.transaction_type === 'capital_withdrawal') {
          capitalWithdrawals += transaction.amount;
        }
      });

      const expensesPaid = expensesData.data?.reduce((sum, expense) => sum + (expense.amount || 0), 0) || 0;
      const loanRepayments = loanPaymentsData.data?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;
      const goodsPurchases = goodsPurchasesData.data?.reduce((sum, purchase) => sum + (purchase.amount || 0), 0) || 0;

      // Calculate totals
      const totalInflow = startingBalance + salesRevenue + investmentsReceived + capitalInjected;
      const totalOutflow = expensesPaid + loanRepayments + goodsPurchases + capitalWithdrawals;
      const netCashFlow = totalInflow - totalOutflow;

      const balanceData: CashBalanceData = {
        availableCashBalance: netCashFlow,
        totalInflow,
        totalOutflow,
        salesRevenue,
        investmentsReceived,
        capitalInjected: startingBalance + capitalInjected,
        expensesPaid,
        loanRepayments,
        goodsPurchases,
        capitalWithdrawals,
        netCashFlow
      };

      setBalance(balanceData);
    } catch (err) {
      console.error('Error fetching cash balance:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch cash balance');
    } finally {
      setLoading(false);
    }
  };
  
  return { balance, loading, error, refetch: fetchBalance };
};

// Enhanced Cash Balance Component for Navbar
const CashBalanceNavbar = () => {
  const { balance, loading, error, refetch } = useCashBalance();
  
  // const formatCompactCurrency = (amount: number) => {
  const formatCompactCurrency = (amount: number) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(1)}Cr`;
    } else if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    } else if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(1)}K`;
    }
    return `₹${amount}`;
  };

  // const formatCurrency = (amount: number) => {
  const formatCurrency = (amount: number) => {
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

  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-200">
        <Wallet className="w-4 h-4 text-red-500" />
        <div className="flex flex-col">
          <span className="text-xs text-red-600">Error</span>
          <span className="text-xs text-red-500">Failed to load</span>
        </div>
        <button
          onClick={refetch}
          className="ml-1 p-1 hover:bg-red-100 rounded transition-colors"
          title="Retry"
        >
          <RefreshCw className="w-3 h-3 text-red-500" />
        </button>
      </div>
    );
  }

  const isPositive = (balance?.availableCashBalance ?? 0) >= 0;
  const isNetPositive = (balance?.netCashFlow ?? 0) >= 0;

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

      {/* Enhanced Quick Summary Tooltip/Dropdown */}
      <div className="relative group hidden lg:block">
        <button className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <span>Details</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {/* Enhanced Dropdown Content */}
        <div className="absolute right-0 top-full mt-2 w-96 bg-card border border-lavender/20 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 backdrop-blur-sm">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Cash Flow Summary</h3>
            
            <div className="space-y-2">
              {/* Inflows Section */}
              <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg">
                <h4 className="text-xs font-semibold text-green-800 dark:text-green-400 mb-2 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Cash Inflows
                </h4>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Sales Revenue</span>
                    <span className="text-xs text-green-600">
                      +{formatCurrency(balance?.salesRevenue || 0)}
                    </span>
                  </div>
                  
                  {(balance?.investmentsReceived ?? 0) > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Investments</span>
                      <span className="text-xs text-green-600">
                        +{formatCurrency(balance.investmentsReceived)}
                      </span>
                    </div>
                  )}

                  {(balance?.capitalInjected ?? 0) > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Capital Injected</span>
                      <span className="text-xs text-green-600">
                        +{formatCurrency(balance.capitalInjected)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Outflows Section */}
              <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg">
                <h4 className="text-xs font-semibold text-red-800 dark:text-red-400 mb-2 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  Cash Outflows
                </h4>
                
                <div className="space-y-1">
                  {/* <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Goods Purchased</span>
                    <span className="text-xs text-red-600">
                      -{formatCurrency(balance?.goodsPurchases || 0)}
                    </span>
                  </div> */}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Operating Expenses</span>
                    <span className="text-xs text-red-600">
                      -{formatCurrency(balance?.expensesPaid || 0)}
                    </span>
                  </div>

                  {(balance?.loanRepayments ?? 0) > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Loan Repayments</span>
                      <span className="text-xs text-red-600">
                        -{formatCurrency(balance.loanRepayments)}
                      </span>
                    </div>
                  )}

                  {(balance?.capitalWithdrawals ?? 0) > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Capital Withdrawals</span>
                      <span className="text-xs text-red-600">
                        -{formatCurrency(balance.capitalWithdrawals)}
                      </span>
                    </div>
                  )}
                </div>
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
                to="/admin/CashBalancePage" 
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

// Rest of your Layout component remains the same...
const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isSidebarExpanded, setSidebarExpanded] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);

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
    { to: '/admin/CashBalancePage', icon: Wallet, label: 'Cash Balance' },
    { to: '/admin/GrossProfitAnalysis', icon: IndianRupee, label: 'GrossProfitAnalysis' },
    { to: '/admin/rewards', icon: Award , label: 'Rewards' },
  ];

  const navItems = user?.role === 'admin' ? adminNavItems : resellerNavItems;

  const useKeyboardPageNavigation = (navItems: any) => {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (!e.ctrlKey) return;

        const active = document.activeElement;
        if (
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          active?.getAttribute('contenteditable') === 'true'
        ) return;

        const currentIndex = navItems.findIndex((item: any) => item.to === location.pathname);
        if (currentIndex === -1) return;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIndex = (currentIndex + 1) % navItems.length;
          navigate(navItems[nextIndex].to);
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevIndex = (currentIndex - 1 + navItems.length) % navItems.length;
          navigate(navItems[prevIndex].to);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navItems, location.pathname, navigate]);
  };

  useKeyboardPageNavigation(user?.role === 'admin' ? adminNavItems : resellerNavItems);

  // collapse when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const sidebarEl = sidebarRef.current;
      if (sidebarEl && !sidebarEl.contains(e.target as Node)) {
        setSidebarExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
                onClick={() => setSidebarExpanded((prev) => !prev)}
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
                      isSidebarExpanded
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col gap-6">
          {/* Sidebar Navigation (Drawer style on all screens) */}
          <aside
            id="sidebar"
            ref={(el) => (sidebarRef.current = el)}
            className={`
              fixed top-0 left-0 bottom-0 z-50 
              ${isSidebarExpanded ? 'w-64  ' : 'w-20 md:inline hidden'}
              bg-background border-r border-lavender/10 shadow-lg
               overflow-y-auto transition-all duration-300
            `}
          >
            <div className="p-4">
              <nav className="space-y-2">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.to;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarExpanded(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-lavender to-blush text-lavender-foreground shadow-[var(--shadow-soft)]'
                          : 'text-muted-foreground hover:text-foreground hover:bg-lavender/10'
                      }`}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {isSidebarExpanded && <span>{item.label}</span>}
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

export default Layout
