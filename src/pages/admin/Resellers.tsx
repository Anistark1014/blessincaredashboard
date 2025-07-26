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
import { error } from 'console';
// import { console } from 'inspector';
interface Reseller {
  id: string;
  email: string;
  name: string;
  contact_info: any;
  flagged_status: boolean;
  is_active: boolean;
  exclusive_features: string;
  created_at: string;
  region:string;
  role:string;
  total_products_sold:number;
  payment_status:"pending" | "clear"
  payment_amount_remaining: number;
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

  
interface InfoItemProps {
  label: string;
  value: string | number | null | undefined;
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

// Define the return type for getTierInfo
type TierInfo = {
  tier: string;
  svg: string | null;
};

// Function to convert number to Roman numeral
const toRomanNumeral = (num: number): string => {
  const romanNumerals: { [key: number]: string } = {
    1: "I",
    2: "II", 
    3: "III"
  };
  return romanNumerals[num] || "";
};

// Function to get tier info based on total sold
const getTierInfo = (totalSold: number): TierInfo => {
  if (totalSold < 1000) return { tier: "Base", svg: "Base" };
  if (totalSold < 2000) return { tier: "Bronze", svg: "Bronze" };
  if (totalSold < 4000) return { tier: "Silver 1", svg: "Silver" };
  if (totalSold < 6000) return { tier: "Silver 2", svg: "Silver" };
  if (totalSold < 10000) return { tier: "Silver 3", svg: "Silver" };
  if (totalSold < 15000) return { tier: "Gold 1", svg: "Gold" };
  if (totalSold < 20000) return { tier: "Gold 2", svg: "Gold" };
  if (totalSold < 26000) return { tier: "Gold 3", svg: "Gold" };
  if (totalSold < 32000) return { tier: "Crystal 1", svg: "Platinum" };
  if (totalSold < 38000) return { tier: "Crystal 2", svg: "Platinum" };
  if (totalSold < 45000) return { tier: "Crystal 3", svg: "Platinum" };
  return { tier: "Diamond", svg: "Diamond" };
};

// Props type for TierIcon component
type TierIconProps = {
  svgName: string | null;
  tier: string;
};

// Component to render tier icon
const TierIcon: React.FC<TierIconProps> = ({ svgName, tier }) => {
  if (!svgName) return null;
  
  // Extract the tier number if it exists
  const tierMatch = tier.match(/(\d+)$/);
  const tierNumber = tierMatch ? parseInt(tierMatch[1]) : null;
  const romanNumeral = tierNumber ? toRomanNumeral(tierNumber) : null;
  
  return (
    <div className="flex flex-col items-center gap-1 relative" title={tier}>
      <div className='relative'>
      <img 
        src={`/tier/${svgName}.svg`} 
        alt={`${tier} tier`}
        className="w-9 h-9"
      />
      {romanNumeral && (
        <span className="text-xs absolute -bottom-1 -right-0 font-medium bg-secondary p-[1px] rounded-full">
          {romanNumeral}
        </span>
      )}
      </div>
      <span className="text-xs font-normal">
        {tier}
      </span>
    </div>
  );
};


  // Fetch resellers
  useEffect(() => {
    // const fetchResellers = async () => {
    //   try {
    //     const { data:reseller, error:resellerError } = await supabase
    //       .from('users')
    //       .select('*')
    //       .eq('role', 'reseller')
    //       .order('created_at', { ascending: false });

    //     if (resellerError) throw resellerError;
    //     setResellers(reseller as Reseller[]);
    //   } catch (error: any) {
    //     console.error('Error fetching resellers:', error);
    //     toast({
    //       title: "Error",
    //       description: "Failed to fetch resellers",
    //       variant: "destructive",
    //     });
    //   } finally {
    //     setLoading(false);
    //   }
    // };
    const fetchResellers = async () => {
  try {
    const { data: resellerList, error: resellerError } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'reseller')
      .order('created_at', { ascending: false });

    if (resellerError) throw resellerError;
    const updatedResellers: Reseller[] = await Promise.all(
      (resellerList as any[]).map(async (reseller) => {
        const { data: requests, error: requestError } = await supabase
          .from('requests')
          .select('total_amount, amount_paid')
          .eq('reseller_id', reseller.id);

        if (requestError) {
          console.error(`Error fetching requests for ${reseller.name}`, requestError);
          return {
            ...reseller,
            payment_status: 'pending',
            payment_amount_remaining: 0,
          };
        }

        let totalRemaining = 0;
        for (const req of requests) {
          const total = req.total_amount ?? 0;
          const paid = req.amount_paid ?? 0;
          totalRemaining += Math.max(0, total - paid);
        }

        return {
          ...reseller,
          name: reseller.name ?? "Unnamed",
          region: reseller.region ?? "Unknown",
          created_at: reseller.created_at ?? "",
          total_products_sold: reseller.total_products_sold ?? 0,
          payment_status: totalRemaining === 0 ? "clear" : "pending",
          payment_amount_remaining: totalRemaining,
        } as Reseller;

      })
    );

    setResellers(updatedResellers);
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

  const AddResellerForm: React.FC = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    region: '',
  });
  const [loading, setLoading] = useState(false);

  // Call createReseller function from frontend (React)
  
const handleAddReseller = async (
  name: string,
  email: string,
  phone: string,
  region: string
) => {
  // const KEY = import.meta.env.VITE_SUPABASE_EDGE_URL;
  // console.log(KEY+"/createReseller")
  const resellerData = {
    name: name || "Default Name",
    email: email || "default@example.com",
    phone: phone || "0000000000",
    region: region || "Default Region"
  };

  const response = await fetch(`https://virbnugthhbunxxxsizw.functions.supabase.co/createReseller`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, // 👈 required!
    },
    body: JSON.stringify(resellerData),
  });

  const result = await response.json();
  console.log(result)
  if (!response.ok) {
    alert("Error: " + result.error);
    return false;
  }
  return true;
};

    const handleSubmit = async () => {
      const { name, email, phone, region } = formData;
  
      if (!name) {
        toast({
          title: "Missing info",
          description: "Name and Email are required.",
          variant: "destructive",
        });
        return;
      }
  
      setLoading(true);
      try {
  
        let status= await handleAddReseller(name, email, phone, region);

        if(!status) return;
  
        // const { error } = await supabase.from('users').insert([
        //   {
        //     name,
        //     email:email||"",
        //     role: 'reseller',
        //     region,
        //     contact_info: { phone },
        //     is_active: true,
        //     flagged_status: false,
        //     exclusive_features: '',
        //   }
        // ]);
  
        // if (error) throw error;
  
        toast({
          title: "Success",
          description: "New reseller added successfully!",
        });
  
        setFormData({ name: '', email: '', phone: '', region: '' });
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };



  return (
    <div className="space-y-4">
      <Input
        required
        name="name"
        placeholder="Reseller Name"
        value={formData.name}
        onChange={handleChange}
      />
      <Input
        name="email"
        placeholder="Email"
        value={formData.email}
        onChange={handleChange}
      />
      <Input
        name="phone"
        placeholder="Phone"
        value={formData.phone}
        onChange={handleChange}
      />
      <Input
      required
        name="region"
        placeholder="Region"
        value={formData.region}
        onChange={handleChange}
      />

      <Button onClick={handleSubmit} disabled={loading} className="w-full">
        {loading ? "Adding..." : "Add Reseller"}
      </Button>
    </div>
  );
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
      // Find the reseller object to get required fields
      const reseller = resellers.find(r => r.id === resellerId);
      if (!reseller) throw new Error("Reseller not found");

      const { error } = await supabase
        .from('users')
        .update({
          flagged_status: currentStatus,
          region: reseller.region,
          name: reseller.name,
          contact_info: reseller.contact_info,
          created_at: reseller.created_at,
          email: reseller.email,
          exclusive_features: reseller.exclusive_features,
          is_active: reseller.is_active,
          role: reseller.role
        })
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
        .update({
          exclusive_features: exclusiveFeatures,
          region: selectedReseller.region,
          name: selectedReseller.name,
          contact_info: selectedReseller.contact_info,
          created_at: selectedReseller.created_at,
          email: selectedReseller.email,
          is_active: selectedReseller.is_active,
          flagged_status: selectedReseller.flagged_status,
          role: selectedReseller.role
        })
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
    reseller.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

const InfoItem: React.FC<InfoItemProps> = ({ label, value }) => (
  <div>
    <label className="text-sm font-medium ">{label}</label>
    <p className="text-sm ">{value ?? 'Not provided'}</p>
  </div>
);

// console.log(resellers)
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
        <span>
          <Input
            placeholder="Search resellers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </span>
        <Dialog>
  <DialogTrigger asChild>
    <Button variant="default">+ Add Reseller</Button>
  </DialogTrigger>

  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>Add New Reseller</DialogTitle>
    </DialogHeader>

    <AddResellerForm />
  </DialogContent>
</Dialog>

      </div>

      {/* Resellers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Resellers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredResellers.map((reseller) => {
              const tierInfo = getTierInfo(reseller.total_products_sold);
              const isOpen = detailsOpen && selectedReseller?.id === reseller.id;

              return (
                <div
                  key={reseller.id}
                  className="flex flex-col gap-3 p-4 border rounded-lg shadow-sm"
                >
                  {/* Header Summary Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium text-base w-1/3 flex items-center gap-2">
                      <TierIcon svgName={tierInfo.svg} tier={tierInfo.tier} />
                      <span>{reseller.name}</span>
                      <span className="text-sm">| {reseller.region}</span>
                    </div>

                    <div className="flex items-center gap-4 text-sm w-1/3">
                      <span className="font-medium">
                        Sold: <span>{reseller.total_products_sold}</span>
                      </span>
                      <span className="font-medium">
                        Payment:{" "}
                        <span
                          className={
                            reseller.payment_status === "clear"
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {reseller.payment_status}
                        </span>
                      </span>
                    </div>

                    <Dialog open={isOpen} onOpenChange={setDetailsOpen}>
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
                          <DialogTitle className="flex items-center gap-2">
                            Reseller Details - {reseller.name}
                            {selectedReseller && (
                              (() => {
                                const selectedTierInfo = getTierInfo(
                                  selectedReseller.total_products_sold
                                );
                                return (
                                  <>
                                    <TierIcon
                                      svgName={selectedTierInfo.svg}
                                      tier={selectedTierInfo.tier}
                                    />
                                    <span className="text-sm font-normal">
                                      ({selectedTierInfo.tier})
                                    </span>
                                  </>
                                );
                              })()
                            )}
                          </DialogTitle>
                        </DialogHeader>

                        {selectedReseller && (
                          <div className="space-y-6">
                            {/* Basic Info */}
                            <div className="grid grid-cols-2 gap-4">
                              <InfoItem label="Email" value={selectedReseller.email} />
                              <InfoItem
                                label="Company"
                                value={selectedReseller.name || "Not provided"}
                              />
                              <InfoItem
                                label="Phone"
                                value={
                                  selectedReseller.contact_info?.phone || "Not provided"
                                }
                              />
                              <InfoItem
                                label="Joined"
                                value={new Date(
                                  selectedReseller.created_at
                                ).toLocaleDateString()}
                              />
                            </div>

                            {/* Flag Action */}
                            <div className="flex space-x-2">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant={
                                      selectedReseller.flagged_status
                                        ? "destructive"
                                        : "outline"
                                    }
                                    size="sm"
                                  >
                                    {selectedReseller.flagged_status ? (
                                      <FlagOff className="h-4 w-4 mr-1" />
                                    ) : (
                                      <Flag className="h-4 w-4 mr-1" />
                                    )}
                                    {selectedReseller.flagged_status
                                      ? "Unflag"
                                      : "Flag"}{" "}
                                    Reseller
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      {selectedReseller.flagged_status
                                        ? "Unflag"
                                        : "Flag"}{" "}
                                      Reseller
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to{" "}
                                      {selectedReseller.flagged_status
                                        ? "unflag"
                                        : "flag"}{" "}
                                      this reseller?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        handleToggleFlag(
                                          selectedReseller.id,
                                          selectedReseller.flagged_status
                                        )
                                      }
                                    >
                                      Confirm
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>

                            {/* Exclusive Features */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium">
                                Exclusive Features
                              </label>
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
                              <h3 className="text-lg font-semibold mb-3">
                                Requests ({resellerRequests.length})
                              </h3>
                              <div className="space-y-2 max-h-60 overflow-y-auto">
                                {resellerRequests.length > 0 ? (
                                  resellerRequests.map((request) => (
                                    <div
                                      key={request.id}
                                      className="flex items-center justify-between p-3 border rounded"
                                    >
                                      <div className="flex-1">
                                        <div className="flex items-center space-x-2">
                                          <span className="font-medium">
                                            #{request.id.slice(0, 8)}
                                          </span>
                                          <Badge className={getStatusBadge(request.status)}>
                                            {request.status}
                                          </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                          Amount: ${request.total_amount} | Date:{" "}
                                          {new Date(
                                            request.request_date
                                          ).toLocaleDateString()}
                                        </p>
                                      </div>
                                      {request.status === "Pending" && (
                                        <div className="flex space-x-2">
                                          <Button
                                            size="sm"
                                            onClick={() =>
                                              handleRequestStatusUpdate(
                                                request.id,
                                                "Approved"
                                              )
                                            }
                                          >
                                            Approve
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() =>
                                              handleRequestStatusUpdate(
                                                request.id,
                                                "Rejected"
                                              )
                                            }
                                          >
                                            Reject
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm text-muted-foreground text-center py-4">
                                    No requests found
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              );
            })}

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