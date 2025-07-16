import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Search, Package, Eye, ChevronDown, ChevronUp } from 'lucide-react';

interface Request {
  id: string;
  total_amount: number;
  amount_paid: number;
  payment_status: string;
  status: string;
  request_date: string;
  products_ordered: any;
  special_instructions: string;
  admin_notes: string;
}

const ResellerRequests: React.FC = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user?.id) return;

    const fetchRequests = async () => {
      try {
        const { data, error } = await supabase
          .from('requests')
          .select('*')
          .eq('reseller_id', user.id)
          .order('request_date', { ascending: false });

        if (error) throw error;
        setRequests(data as Request[]);
      } catch (error: any) {
        console.error('Error fetching requests:', error);
        toast({
          title: "Error",
          description: "Failed to fetch requests",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();

    // Set up real-time subscription
    const subscription = supabase
      .channel('reseller_requests_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'requests', filter: `reseller_id=eq.${user.id}` },
        (payload) => {
          console.log('Request change received!', payload);
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, toast]);

  const getFilteredRequests = () => {
    return requests.filter(request => {
      const matchesSearch = request.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (request.products_ordered && JSON.stringify(request.products_ordered).toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      const matchesPayment = paymentFilter === 'all' || request.payment_status === paymentFilter;
      
      return matchesSearch && matchesStatus && matchesPayment;
    });
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Approved': 'bg-green-100 text-green-800',
      'Rejected': 'bg-red-100 text-red-800',
      'Shipped': 'bg-blue-100 text-blue-800',
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusColors = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Partially Paid': 'bg-orange-100 text-orange-800',
      'Fully Paid': 'bg-green-100 text-green-800',
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  const toggleExpanded = (requestId: string) => {
    const newExpanded = new Set(expandedRequests);
    if (newExpanded.has(requestId)) {
      newExpanded.delete(requestId);
    } else {
      newExpanded.add(requestId);
    }
    setExpandedRequests(newExpanded);
  };

  const formatProductsOrdered = (products: any) => {
    if (!products) return 'No products';
    
    if (typeof products === 'string') {
      try {
        products = JSON.parse(products);
      } catch {
        return products;
      }
    }
    
    if (Array.isArray(products)) {
      return products.map((p, index) => (
        <div key={index} className="text-sm">
          {p.name || p.product_name || 'Unknown Product'} - Qty: {p.quantity || 1}
          {p.price && ` ($${p.price})`}
        </div>
      ));
    }
    
    return JSON.stringify(products);
  };

  const getTotalRequests = () => requests.length;
  const getPendingRequests = () => requests.filter(r => r.status === 'Pending').length;
  const getApprovedRequests = () => requests.filter(r => r.status === 'Approved').length;
  const getTotalValue = () => requests.reduce((sum, r) => sum + Number(r.total_amount), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">My Requests</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTotalRequests()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{getPendingRequests()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{getApprovedRequests()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${getTotalValue().toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex items-center space-x-2 flex-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
            <SelectItem value="Shipped">Shipped</SelectItem>
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Partially Paid">Partially Paid</SelectItem>
            <SelectItem value="Fully Paid">Fully Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>Request History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {getFilteredRequests().map((request) => (
              <div key={request.id} className="border rounded-lg">
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-semibold">Request #{request.id.slice(0, 8)}</h3>
                        <Badge className={getStatusBadge(request.status)}>
                          {request.status}
                        </Badge>
                        <Badge className={getPaymentStatusBadge(request.payment_status)}>
                          {request.payment_status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium">Total Amount:</span> ${Number(request.total_amount).toFixed(2)}
                        </div>
                        <div>
                          <span className="font-medium">Amount Paid:</span> ${Number(request.amount_paid).toFixed(2)}
                        </div>
                        <div>
                          <span className="font-medium">Request Date:</span> {new Date(request.request_date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Dialog open={detailsOpen && selectedRequest?.id === request.id} onOpenChange={setDetailsOpen}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedRequest(request)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Request Details - #{request.id.slice(0, 8)}</DialogTitle>
                          </DialogHeader>
                          {selectedRequest && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium">Status</label>
                                  <Badge className={getStatusBadge(selectedRequest.status)}>
                                    {selectedRequest.status}
                                  </Badge>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Payment Status</label>
                                  <Badge className={getPaymentStatusBadge(selectedRequest.payment_status)}>
                                    {selectedRequest.payment_status}
                                  </Badge>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Total Amount</label>
                                  <p>${Number(selectedRequest.total_amount).toFixed(2)}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Amount Paid</label>
                                  <p>${Number(selectedRequest.amount_paid).toFixed(2)}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Outstanding</label>
                                  <p className="text-red-600 font-semibold">
                                    ${(Number(selectedRequest.total_amount) - Number(selectedRequest.amount_paid)).toFixed(2)}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Request Date</label>
                                  <p>{new Date(selectedRequest.request_date).toLocaleDateString()}</p>
                                </div>
                              </div>
                              
                              <div>
                                <label className="text-sm font-medium">Products Ordered</label>
                                <div className="mt-1 p-3 bg-gray-50 rounded">
                                  {formatProductsOrdered(selectedRequest.products_ordered)}
                                </div>
                              </div>
                              
                              {selectedRequest.special_instructions && (
                                <div>
                                  <label className="text-sm font-medium">Special Instructions</label>
                                  <p className="mt-1 text-sm">{selectedRequest.special_instructions}</p>
                                </div>
                              )}
                              
                              {selectedRequest.admin_notes && (
                                <div>
                                  <label className="text-sm font-medium">Admin Notes</label>
                                  <p className="mt-1 text-sm text-blue-600">{selectedRequest.admin_notes}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(request.id)}
                      >
                        {expandedRequests.has(request.id) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
                
                {expandedRequests.has(request.id) && (
                  <div className="border-t p-4 bg-gray-50">
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium">Products Ordered</label>
                        <div className="mt-1">
                          {formatProductsOrdered(request.products_ordered)}
                        </div>
                      </div>
                      
                      {request.special_instructions && (
                        <div>
                          <label className="text-sm font-medium">Special Instructions</label>
                          <p className="text-sm mt-1">{request.special_instructions}</p>
                        </div>
                      )}
                      
                      {request.admin_notes && (
                        <div>
                          <label className="text-sm font-medium">Admin Notes</label>
                          <p className="text-sm mt-1 text-blue-600">{request.admin_notes}</p>
                        </div>
                      )}
                      
                      <div className="flex justify-between text-sm">
                        <span>Outstanding: <strong className="text-red-600">
                          ${(Number(request.total_amount) - Number(request.amount_paid)).toFixed(2)}
                        </strong></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {getFilteredRequests().length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No requests found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResellerRequests;