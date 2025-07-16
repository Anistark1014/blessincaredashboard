import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  Users,
  Package,
  TrendingUp,
  AlertTriangle,
  Calendar,
  ShoppingCart,
  CreditCard
} from 'lucide-react';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: reqData, error: reqError } = await supabase
        .from('product_request_items')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: productData, error: prodError } = await supabase
        .from('products')
        .select('*');

      if (!reqError && reqData) setRequests(reqData);
      if (!prodError && productData) setProducts(productData);

      setLoading(false);
    };

    fetchData();
  }, []);

  const totalRevenue = requests.reduce((sum, req) => sum + (req.totalAmount || 0), 0);
  const totalExpenses = totalRevenue * 0.35; // Just a rough placeholder logic
  const profit = totalRevenue - totalExpenses;

  const totalOrders = requests.length;
  const pendingRequests = requests.filter(req => req.status === 'pending').length;
  const resellersWithDues = requests.filter(req =>
    req.paymentStatus === 'pending' || req.paymentStatus === 'partial'
  ).length;

  const recentRequests = requests.slice(0, 5);
  const lowStockProducts = products.filter(p =>
    p.availability === 'low-stock' || p.availability === 'out-of-stock'
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'approved': return 'status-approved';
      case 'delivered': return 'status-success';
      case 'shipped': return 'bg-blush text-blush-foreground';
      case 'in-production': return 'bg-lavender text-lavender-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'status-error';
      case 'partial': return 'status-warning';
      case 'paid': return 'status-success';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6 fade-in-up">
      {/* Header */}
      <div className="healthcare-card">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Monitor your women&apos;s healthcare business performance
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/products">
              <Button variant="outline">
                <Package className="w-4 h-4 mr-2" />
                Manage Products
              </Button>
            </Link>
            <Link to="/admin/resellers">
              <Button className="btn-healthcare">
                <Users className="w-4 h-4 mr-2" />
                View Resellers
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(pendingRequests > 0 || resellersWithDues > 0 || lowStockProducts.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {pendingRequests > 0 && (
            <Card className="border-warning/20 bg-warning/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-warning" />
                  <div>
                    <p className="font-medium text-foreground">{pendingRequests} Pending Requests</p>
                    <p className="text-sm text-muted-foreground">Require your approval</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {resellersWithDues > 0 && (
            <Card className="border-error/20 bg-error/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-error" />
                  <div>
                    <p className="font-medium text-foreground">{resellersWithDues} Payment Issues</p>
                    <p className="text-sm text-muted-foreground">Resellers with outstanding dues</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {lowStockProducts.length > 0 && (
            <Card className="border-warning/20 bg-warning/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  <div>
                    <p className="font-medium text-foreground">{lowStockProducts.length} Low Stock Items</p>
                    <p className="text-sm text-muted-foreground">Need inventory replenishment</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="healthcare-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">+12% from last month</p>
          </CardContent>
        </Card>

        <Card className="healthcare-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalOrders}</div>
            <p className="text-xs text-muted-foreground">+3 new this week</p>
          </CardContent>
        </Card>

        <Card className="healthcare-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Resellers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">8</div>
            <p className="text-xs text-muted-foreground">2 new this month</p>
          </CardContent>
        </Card>

        <Card className="healthcare-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profit >= 0 ? 'text-success' : 'text-error'}`}>
              ${profit.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalRevenue > 0 ? `${(profit / totalRevenue * 100).toFixed(1)}% margin` : 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Requests */}
        <Card className="healthcare-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Requests</CardTitle>
              <Link to="/admin/resellers">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </div>
            <CardDescription>Latest product requests from resellers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/40">
                <div className="flex-1">
                  <p className="font-medium text-foreground">#{request.id}</p>
                  <p className="text-sm text-muted-foreground">{request.resellerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {request.products?.length || 0} items • ${request.totalAmount?.toFixed(2)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className={getStatusColor(request.status)}>
                    {request.status}
                  </Badge>
                  <Badge className={getPaymentStatusColor(request.paymentStatus)}>
                    {request.paymentStatus}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Inventory Alerts */}
        <Card className="healthcare-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Inventory Alerts</CardTitle>
              <Link to="/admin/products">
                <Button variant="ghost" size="sm">Manage</Button>
              </Link>
            </div>
            <CardDescription>Products requiring attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lowStockProducts.length > 0 ? (
              lowStockProducts.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/40">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{product.name}</p>
                    <p className="text-sm text-muted-foreground">{product.category}</p>
                    <p className="text-xs text-muted-foreground">${product.price}</p>
                  </div>
                  <Badge className={
                    product.availability === 'out-of-stock'
                      ? 'status-error'
                      : 'status-warning'
                  }>
                    {product.availability.replace('-', ' ')}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-muted-foreground">All products are well stocked</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
