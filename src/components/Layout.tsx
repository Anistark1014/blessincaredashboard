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
  Flower2
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import ToggleTheme from './ToggleTheme';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  
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
  ];

  const navItems = user?.role === 'admin' ? adminNavItems : resellerNavItems;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-lavender/5 to-blush/5">
      {/* Top Navigation */}
      <nav className="bg-card/80 backdrop-blur-sm border-b border-lavender/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-lavender to-blush rounded-full flex items-center justify-center shadow-[var(--shadow-soft)]">
                <Heart className="w-5 h-5 text-lavender-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Women's Healthcare</h1>
                <p className="text-xs text-muted-foreground capitalize">{user?.role} Portal</p>
              </div>
            </div>

            {/* User Actions */}
            <div className="flex items-center gap-4">
              <span>
                <ToggleTheme/>
              </span>
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-blush rounded-full pulse-soft"></span>
              </Button>
              
              <div className="flex items-center gap-3">
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
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <aside className="lg:w-64 flex-shrink-0">
            <div className="healthcare-card p-4">
              <nav className="space-y-2">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.to;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
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