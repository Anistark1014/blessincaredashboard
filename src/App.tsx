import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Auth from "./pages/Auth";
import Layout from "./components/Layout";
import ResellerDashboard from "./pages/reseller/Dashboard";
import ProductCatalog from "./pages/reseller/Catalog";
import AdminDashboard from "./pages/admin/Dashboard";
import NotFound from "./pages/NotFound";
import AdminProducts from "./pages/admin/Products";
import AdminResellers from "./pages/admin/Resellers";
import AdminSales from "./pages/admin/Sales";
import AdminExpenses from "./pages/admin/Expenses";
import ResellerRequests from "./pages/reseller/Requests";
import AdminInventory from "./pages/admin/Inventory";
import ProductDetails from "./pages/ProductDetails";

const queryClient = new QueryClient();

// Dashboard Redirect Component
const DashboardRedirect: React.FC = () => {
  const { isAuthenticated, user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-lavender"></div>
    </div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  // Redirect based on user role
  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  } else {
    return <Navigate to="/reseller" replace />;
  }
};

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRole?: 'reseller' | 'admin' }> = ({ 
  children, 
  allowedRole 
}) => {
  const { isAuthenticated, user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-lavender"></div>
    </div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  if (allowedRole && user?.role !== allowedRole) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/reseller'} replace />;
  }
  
  return <Layout>{children}</Layout>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/auth" element={<Auth />} />
            
            {/* Protected Routes - Auto redirect based on role */}
            <Route path="/" element={<DashboardRedirect />} />
            <Route path="/dashboard" element={<DashboardRedirect />} />
            
            {/* Reseller Routes */}
            <Route path="/reseller" element={
              <ProtectedRoute allowedRole="reseller">
                <ResellerDashboard />
              </ProtectedRoute>
            } />
            <Route path="/reseller/catalog" element={
              <ProtectedRoute allowedRole="reseller">
                <ProductCatalog />
              </ProtectedRoute>
            } />
            <Route path="/reseller/requests" element={
              <ProtectedRoute allowedRole="reseller">
                <ResellerRequests/>
              </ProtectedRoute>
            } />
            <Route path="/reseller/payments" element={
              <ProtectedRoute allowedRole="reseller">
                <div className="healthcare-card p-6">
                  <h1 className="text-2xl font-bold text-foreground mb-4">Payments</h1>
                  <p className="text-muted-foreground">Manage your payments here.</p>
                </div>
              </ProtectedRoute>
            } />
            
            {/* Admin Routes */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/products" element={
              <ProtectedRoute allowedRole="admin">
                <AdminProducts/>
              </ProtectedRoute>
            } />
            <Route path="/admin/resellers" element={
              <ProtectedRoute allowedRole="admin">
                <AdminResellers/>
              </ProtectedRoute>
            } />
            <Route path="/admin/sales" element={
              <ProtectedRoute allowedRole="admin">
                <AdminSales/>
              </ProtectedRoute>
            } />
            <Route path="/admin/expenses" element={
              <ProtectedRoute allowedRole="admin">
                <AdminExpenses/>
              </ProtectedRoute>
            } />
             <Route path="/admin/inventory" element={
              <ProtectedRoute allowedRole="admin">
                <AdminInventory />
              </ProtectedRoute>
            } />

            <Route path="/reseller/product/:id" element={
                <ProtectedRoute allowedRole="reseller">
                  <ProductDetails />
                </ProtectedRoute>
              } />
            <Route path="/admin/product/:id" element={
                <ProtectedRoute allowedRole="admin">
                  <ProductDetails />
                </ProtectedRoute>
              } />

            
            {/* Catch all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
