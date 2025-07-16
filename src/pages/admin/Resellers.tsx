import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Eye, Flag, FlagOff, Search, Users, UserCheck, UserX } from 'lucide-react';

// interface User{
//   id: string;
//   email: string;
//   role: string;
//   company_name: string | null;
//   contact_info: JSON | null;
//   created_at: string | null;
//   exclusive_features: string | null;
//   flagged_status: boolean | null;
//   is_active: boolean | null;
// }

interface Reseller {
  id: string;
  email: string;
  company_name: string;
  contact_info: any;
  flagged_status: boolean;
  is_active: boolean;
  exclusive_features: string;
  created_at: string;
}

interface Request {
  id: string;
  reseller_id: string;
  products_ordered: any;
  total_amount: number;
  status: string;
  payment_status: string;
  request_date: string;
  special_instructions: string;
  admin_notes: string;
}

// interface Payment {
//   id: string;
//   reseller_id: string;
//   amount: number;
//   payment_date: string;
//   method: string;
//   payment_type: string;
// }

const AdminResellers: React.FC = () => {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [selectedReseller, setSelectedReseller] = useState<Reseller | null>(null);
  const [resellerRequests, setResellerRequests] = useState<Request[]>([]);
  // const [resellerPayments, setResellerPayments] = useState<Payment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [exclusiveFeatures, setExclusiveFeatures] = useState('');
  const { toast } = useToast();

  // Fetch resellers
  useEffect(() => {
    const fetchResellers = async () => {
      try {
        const { data:reseller, error:resellerError } = await supabase
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

    fetchResellers();

    // Set up real-time subscription
    const subscription = supabase
      .channel('resellers_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'users', filter: 'role=eq.reseller' },
        (payload) => {
          console.log('Reseller change received!', payload);
          fetchResellers();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [toast]);

  // Fetch reseller details when selected
  useEffect(() => {
    if (selectedReseller) {
      setExclusiveFeatures(selectedReseller.exclusive_features || '');
      fetchResellerDetails(selectedReseller.id);
    }
  }, [selectedReseller]);

  const fetchResellerDetails = async (resellerId: string) => {
    try {
      // Fetch requests
      const { data: requests, error: requestsError } = await supabase
        .from('requests')
        .select('*')
        .eq('reseller_id', resellerId)
        .order('request_date', { ascending: false });

      if (requestsError) throw requestsError;
      setResellerRequests(requests as Request[]);

      // Fetch payments
      // const { data: payments, error: paymentsError } = await supabase
      //   .from('payments')
      //   .select('*')
      //   .eq('reseller_id', resellerId)
      //   .order('payment_date', { ascending: false });

      // if (paymentsError) throw paymentsError;
      // setResellerPayments(payments as Payment[]);
    } catch (error: any) {
      console.error('Error fetching reseller details:', error);
      toast({
        title: "Error",
        description: "Failed to fetch reseller details",
        variant: "destructive",
      });
    }
  };

  const handleRequestStatusUpdate = async (requestId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (error) throw error;

      // Create notification for reseller
      await supabase
        .from('notifications')
        .insert({
          user_id: selectedReseller?.id,
          type: 'request_status_update',
          message: `Your request has been ${newStatus.toLowerCase()}`,
          related_entity_id: requestId,
          role: 'reseller'
        });

      // Refresh requests
      if (selectedReseller) {
        fetchResellerDetails(selectedReseller.id);
      }

      toast({
        title: "Success",
        description: `Request ${newStatus.toLowerCase()} successfully`,
      });
    } catch (error: any) {
      console.error('Error updating request status:', error);
      toast({
        title: "Error",
        description: "Failed to update request status",
        variant: "destructive",
      });
    }
  };

  const handleToggleFlag = async (resellerId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ flagged_status: !currentStatus })
        .eq('id', resellerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Reseller ${!currentStatus ? 'flagged' : 'unflagged'} successfully`,
      });
    } catch (error: any) {
      console.error('Error toggling flag:', error);
      toast({
        title: "Error",
        description: "Failed to update flag status",
        variant: "destructive",
      });
    }
  };

  const handleUpdateExclusiveFeatures = async () => {
    if (!selectedReseller) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ exclusive_features: exclusiveFeatures })
        .eq('id', selectedReseller.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Exclusive features updated successfully",
      });
    } catch (error: any) {
      console.error('Error updating exclusive features:', error);
      toast({
        title: "Error",
        description: "Failed to update exclusive features",
        variant: "destructive",
      });
    }
  };

  const filteredResellers = resellers.filter(reseller =>
    reseller.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reseller.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statusColors = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Approved': 'bg-green-100 text-green-800',
      'Rejected': 'bg-red-100 text-red-800',
      'Shipped': 'bg-blue-100 text-blue-800',
    };
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

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
        <h1 className="text-3xl font-bold text-foreground">Reseller Management</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Resellers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resellers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resellers.filter(r => r.is_active).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Flagged</CardTitle>
            <Flag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resellers.filter(r => r.flagged_status).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resellers.filter(r => !r.is_active).length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search resellers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Resellers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Resellers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredResellers.map((reseller) => (
              <div key={reseller.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold">{reseller.company_name || 'No Company Name'}</h3>
                    {reseller.flagged_status && (
                      <Badge variant="destructive">
                        <Flag className="h-3 w-3 mr-1" />
                        Flagged
                      </Badge>
                    )}
                    {!reseller.is_active && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{reseller.email}</p>
                  <p className="text-sm text-muted-foreground">
                    Phone: {reseller.contact_info?.phone || 'Not provided'}
                  </p>
                </div>
                <Dialog open={detailsOpen && selectedReseller?.id === reseller.id} onOpenChange={setDetailsOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedReseller(reseller)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Details
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Reseller Details - {reseller.company_name}</DialogTitle>
                    </DialogHeader>
                    
                    {selectedReseller && (
                      <div className="space-y-6">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium">Email</label>
                            <p className="text-sm">{selectedReseller.email}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Company</label>
                            <p className="text-sm">{selectedReseller.company_name || 'Not provided'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Phone</label>
                            <p className="text-sm">{selectedReseller.contact_info?.phone || 'Not provided'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Joined</label>
                            <p className="text-sm">{new Date(selectedReseller.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex space-x-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant={selectedReseller.flagged_status ? "destructive" : "outline"} size="sm">
                                {selectedReseller.flagged_status ? <FlagOff className="h-4 w-4 mr-1" /> : <Flag className="h-4 w-4 mr-1" />}
                                {selectedReseller.flagged_status ? 'Unflag' : 'Flag'} Reseller
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {selectedReseller.flagged_status ? 'Unflag' : 'Flag'} Reseller
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to {selectedReseller.flagged_status ? 'unflag' : 'flag'} this reseller?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleToggleFlag(selectedReseller.id, selectedReseller.flagged_status)}
                                >
                                  Confirm
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>

                        {/* Exclusive Features */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Exclusive Features</label>
                          <Textarea
                            value={exclusiveFeatures}
                            onChange={(e) => setExclusiveFeatures(e.target.value)}
                            placeholder="Enter exclusive features for this reseller..."
                          />
                          <Button onClick={handleUpdateExclusiveFeatures} size="sm">
                            Save Features
                          </Button>
                        </div>

                        {/* Requests */}
                        <div>
                          <h3 className="text-lg font-semibold mb-3">Requests ({resellerRequests.length})</h3>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {resellerRequests.map((request) => (
                              <div key={request.id} className="flex items-center justify-between p-3 border rounded">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-medium">#{request.id.slice(0, 8)}</span>
                                    <Badge className={getStatusBadge(request.status)}>
                                      {request.status}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    Amount: ${request.total_amount} | Date: {new Date(request.request_date).toLocaleDateString()}
                                  </p>
                                </div>
                                {request.status === 'Pending' && (
                                  <div className="flex space-x-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleRequestStatusUpdate(request.id, 'Approved')}
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleRequestStatusUpdate(request.id, 'Rejected')}
                                    >
                                      Reject
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                            {resellerRequests.length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4">No requests found</p>
                            )}
                          </div>
                        </div>

                        {/* Payments */}
                        {/* <div>
                          <h3 className="text-lg font-semibold mb-3">Payments ({resellerPayments.length})</h3>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {resellerPayments.map((payment) => (
                              <div key={payment.id} className="flex items-center justify-between p-3 border rounded">
                                <div>
                                  <span className="font-medium">${payment.amount}</span>
                                  <p className="text-sm text-muted-foreground">
                                    {payment.method} | {new Date(payment.payment_date).toLocaleDateString()}
                                  </p>
                                </div>
                                <Badge variant="outline">{payment.payment_type}</Badge>
                              </div>
                            ))}
                            {resellerPayments.length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4">No payments found</p>
                            )}
                          </div>
                        </div> */}
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            ))}

            {filteredResellers.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No resellers found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminResellers;