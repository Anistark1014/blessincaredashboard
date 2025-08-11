import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  Package,
  AlertTriangle,
  Calendar,
  CreditCard
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import {AdminSettings} from '@/components/AdminSettings';


const AdminDashboard = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [resellers, setResellers] = useState<any>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  interface Reseller {
    id: string;
    email: string;
    name: string;
    contact_info: any;
    flagged_status: boolean;
    is_active: boolean;
    exclusive_features: string;
    created_at: string;
    region: string;
    role: string;
    total_products_sold: number;
    payment_status: "pending" | "clear"
    payment_amount_remaining: number;
  }

  useEffect(() => {
    const fetchResellers = async () => {
      try {
        const { data: reseller, error: resellerError } = await supabase
          .from('users')
          .select('*')
          .eq('role', 'reseller')
          .order('created_at', { ascending: false });

        if (resellerError) throw resellerError;
        setResellers(reseller as Reseller[]);
      } catch (error: any) {
        console.error('Error fetching resellers:', error);
        toast({
          title: "Error",
          description: "Failed to fetch resellers",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    const fetchData = async () => {
      setLoading(true);

      const { data: reqData, error: reqError } = await supabase
        .from('requests')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: productData, error: prodError } = await supabase
        .from('products')
        .select('*');

      if (!reqError && reqData) setRequests(reqData);
      if (!prodError && productData) setProducts(productData);

      setLoading(false);
    };
    fetchResellers();
    fetchData();
  }, []);

  const handleStatusChange = async (requestId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (error) throw error;

      setRequests(prev =>
        prev.map(req =>
          req.id === requestId ? { ...req, status: newStatus } : req
        )
      );

      toast({
        title: "Success",
        description: "Request status updated successfully.",
      });
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: "Failed to update request status.",
        variant: "destructive",
      });
    }
  };

  const totalRevenue = requests.reduce((sum, req) => sum + (req.totalAmount || 0), 0);
  const totalExpenses = totalRevenue * 0.35;
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




  return (
    <>
    <div className="space-y-6 fade-in-up" tabIndex={-1} aria-label="Admin Dashboard Main Content">
      {/* Header */}
      <div className="healthcare-card" role="region" aria-labelledby="dashboard-header">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 id="dashboard-header" className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Monitor your women&apos;s healthcare business performance
            </p>
          </div>
          <div className="flex md:flex-row flex-col gap-2">
            <Link to="/admin/products">
            <Button variant="outline" aria-label="Manage Products (Alt+P)" tabIndex={0}>
                <Package className="w-4 h-4 mr-2" />
                Manage Products
              </Button>
            </Link>
            <Link to="/admin/resellers">
              <Button className="btn-healthcare" aria-label="View Resellers (Alt+R)" tabIndex={0}>
                <Users className="w-4 h-4 mr-2" />
                View Resellers
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(pendingRequests > 0 || resellersWithDues > 0 || lowStockProducts.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" role="region" aria-label="Alerts">
          {pendingRequests > 0 && (
            <Card className="border-warning/20 bg-warning/5" role="alert" aria-live="polite">
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
            <Card className="border-error/20 bg-error/5" role="alert" aria-live="polite">
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
            <Card className="border-warning/20 bg-warning/5" role="alert" aria-live="polite">
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

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" role="region" aria-label="Recent Activity">
        {/* Recent Requests */}
        <Card className="healthcare-card" role="region" aria-labelledby="recent-requests-header">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle id="recent-requests-header">Recent Requests</CardTitle>
              <Link to="/admin/resellers">
                <Button variant="ghost" size="sm" aria-label="View All Requests">View All</Button>
              </Link>
            </div>
            <CardDescription>Latest product requests from resellers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/40 focus:outline focus:outline-2 focus:outline-primary" tabIndex={0} aria-label={`Request by ${resellers.find((reseller: any) => reseller.id === request.reseller_id)?.name || "Unknown"}`}> 
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {resellers.find((reseller: any) => reseller.id === request.reseller_id)?.name || "hello"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {request.products_ordered[0] || 0} items • ${request.total_amount?.toFixed(2)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge
                    className={`text-xs px-2 py-1 rounded ${
                      request.status === 'approved'
                        ? 'bg-green-200 text-green-800'
                        : 'bg-yellow-200 text-yellow-800'
                    }`}
                    aria-label={`Status: ${request.status}`}
                  >
                    {request.status}
                  </Badge>

                  <select
                    value={request.status}
                    onChange={(e) => handleStatusChange(request.id, e.target.value)}
                    className="text-xs border border-border rounded px-2 py-1 mt-1 bg-background text-foreground focus:outline focus:outline-2 focus:outline-primary"
                    aria-label="Change request status"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                  </select>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        
        <div className="flex flex-col justify-start items-start gap-2 w-full">
            <button id="admin-settings-btn" aria-label="Open Admin Settings (Alt+/)" tabIndex={0} className="focus:outline focus:outline-2 focus:outline-primary">
              <AdminSettings />
            </button>
          {/* Inventory Alerts */}
          <Card className="healthcare-card w-full" role="region" aria-labelledby="inventory-alerts-header">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle id="inventory-alerts-header">Inventory Alerts</CardTitle>
                <Link to="/admin/products">
                  <Button variant="ghost" size="sm" aria-label="Manage Products">Manage</Button>
                </Link>
              </div>
              <CardDescription>Products requiring attention</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {lowStockProducts.length > 0 ? (
                lowStockProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/40 focus:outline focus:outline-2 focus:outline-primary" tabIndex={0} aria-label={`Product ${product.name}, ${product.availability.replace('-', ' ')}`}> 
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.category}</p>
                      <p className="text-xs text-muted-foreground">${product.price}</p>
                    </div>
                    <Badge className={
                      product.availability === 'out-of-stock'
                        ? 'status-error'
                        : 'status-warning'
                    } aria-label={product.availability.replace('-', ' ')}>
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
    </div>
    </>
  );
};

export default AdminDashboard;
