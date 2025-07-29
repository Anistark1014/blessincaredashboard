import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient'; // Ensure this is your client-side Supabase instance
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'; // Added DialogClose
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Eye, Flag, FlagOff, Search, Users, UserCheck, CheckCircle2, XCircle } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';


// --- IMPORTANT: Define your Deno Edge Function URL here ---
const DENO_ADD_RESELLER_FUNCTION_URL = import.meta.env.VITE_ADD_RESELLER_FUNCTION_URL || 'YOUR_DENO_FUNCTION_URL_HERE';

// Define the interfaces based on your provided structure
interface Reseller {
  id: string;
  email: string | null;
  name: string | null;
  contact_info: { phone?: string | null } | null;
  flagged_status: boolean;
  is_active: boolean; // Represents login access / verified status
  exclusive_features: string | null;
  created_at: string;
  region: string | null;
  role: string;
  total_products_sold: number;
  payment_status: "pending" | "clear";
  payment_amount_remaining: number;
  total_revenue_generated?: number; // Added for KPI & table column
  reward_points?: number; // Added for details view
  coverage?: number | null; // Added for details view (editable)
  sub_active_resellers?: number; // Placeholder for sub-hierarchy active resellers
  sub_passive_resellers?: number; // Placeholder for sub-hierarchy passive resellers
}

interface Request {
  id: string;
  reseller_id: string;
  products_ordered: any;
  total_amount: number;
  status: string;
  payment_status: string;
  request_date: string;
  special_instructions: string | null;
  admin_notes: string | null;
}

interface InfoItemProps {
  label: string;
  value: string | number | null | undefined;
}

// Helper component for displaying info items consistently
const InfoItem: React.FC<InfoItemProps> = ({ label, value }) => (
  <div className="flex flex-col">
    <label className="text-sm font-medium text-muted-foreground">{label}</label>
    <p className="text-base font-semibold text-foreground">{value ?? 'N/A'}</p>
  </div>
);

type TierInfo = {
  tier: string;
  svg: string | null;
};

const toRomanNumeral = (num: number): string => {
  const romanNumerals: { [key: number]: string } = {
    1: "I", 2: "II", 3: "III"
  };
  return romanNumerals[num] || "";
};

const getTierInfo = (totalSold: number): TierInfo => {
  if (totalSold < 1000) return { tier: "Base", svg: "Base" };
  if (totalSold < 2000) return { tier: "Bronze", svg: "Bronze" };
  if (totalSold < 4000) return { tier: "Silver I", svg: "Silver" };
  if (totalSold < 6000) return { tier: "Silver II", svg: "Silver" };
  if (totalSold < 10000) return { tier: "Silver III", svg: "Silver" };
  if (totalSold < 15000) return { tier: "Gold I", svg: "Gold" };
  if (totalSold < 20000) return { tier: "Gold II", svg: "Gold" };
  if (totalSold < 26000) return { tier: "Gold III", svg: "Gold" };
  if (totalSold < 32000) return { tier: "Crystal I", svg: "Crystal" };
  if (totalSold < 38000) return { tier: "Crystal II", svg: "Crystal" };
  if (totalSold < 45000) return { tier: "Crystal III", svg: "Crystal" };
  return { tier: "Diamond", svg: "Diamond" };
};

interface TierIconProps {
  svgName: string | null;
  tier: string;
}

const TierIcon: React.FC<TierIconProps> = ({ svgName, tier }) => {
  if (!svgName) return null;

  const tierParts = tier.split(' ');
  const mainTier = tierParts[0];
  const romanNumeral = tierParts.length > 1 ? toRomanNumeral(parseInt(tierParts[1])) : null;

  return (
    <div className="flex flex-col items-center gap-1 relative" title={tier}>
      <div className='relative'>
        <img
          src={`/tier/${mainTier}.svg`} // Ensure your SVGs are in /public/tier/
          alt={`${tier} tier`}
          className="w-9 h-9"
        />
        {romanNumeral && (
          <span className="text-xs absolute -bottom-1 -right-0 font-medium bg-primary text-primary-foreground p-[1px] rounded-full min-w-[18px] text-center">
            {romanNumeral}
          </span>
        )}
      </div>
    </div>
  );
};

const AdminResellers: React.FC = () => {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [selectedReseller, setSelectedReseller] = useState<Reseller | null>(null);
  const [resellerRequests, setResellerRequests] = useState<Request[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false); // Controls the "View Details" dialog

  // Editable fields for reseller details (within the details dialog)
const [editableResellerName, setEditableResellerName] = useState('');
const [editableEmail, setEditableEmail] = useState('');
const [editableRegion, setEditableRegion] = useState('');
const [editableCoverage, setEditableCoverage] = useState<number | ''>('');

  const [exclusiveFeatures, setExclusiveFeatures] = useState('');
  const [isLoginAccessEnabled, setIsLoginAccessEnabled] = useState(false);

  //Graph data
  const [resellerSales, setResellerSales] = useState<Request[]>([]);
const [chartData, setChartData] = useState<{ month: string; revenue: number }[]>([]);


  const { toast } = useToast();

  const fetchResellers = async () => {
    setLoading(true);
    try {
      const { data: resellerList, error: resellerError } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'reseller')
        .order('created_at', { ascending: false });
      console.log(resellerList)
      if (resellerError) throw resellerError;

      const updatedResellers: Reseller[] = await Promise.all(
        (resellerList as any[]).map(async (reseller) => {
          const { data: requests, error: requestError } = await supabase
            .from('requests')
            .select('total_amount, amount_paid')
            .eq('reseller_id', reseller.id);

          if (requestError) {
            console.error(`Error fetching requests for ${reseller.name}:`, requestError);
            return {
              ...reseller,
              name: reseller.name ?? "Unnamed",
              region: reseller.region ?? "Unknown",
              created_at: reseller.created_at ?? "",
              total_products_sold: reseller.total_products_sold ?? 0,
              payment_status: 'pending',
              payment_amount_remaining: 0,
              total_revenue_generated: 0,
              reward_points: 0,
              is_active: reseller.is_active ?? false,
              flagged_status: reseller.flagged_status ?? false,
              exclusive_features: reseller.exclusive_features ?? '',
              coverage: reseller.coverage ?? 0,
              sub_active_resellers: 0,
              sub_passive_resellers: 0,
            } as Reseller;
          }

          let totalRemaining = 0;
          let totalRevenue = 0;
          for (const req of requests) {
            const total = req.total_amount ?? 0;
            const paid = req.amount_paid ?? 0;
            totalRemaining += Math.max(0, total - paid);
            totalRevenue += total;
          }

          const rewardPoints = Math.floor(totalRevenue / 100);

          const subActiveResellers = 0; // Requires actual logic
          const subPassiveResellers = 0; // Requires actual logic

          return {
            ...reseller,
            name: reseller.name ?? "Unnamed",
            email: reseller.email ?? null,
            contact_info: reseller.contact_info ?? null,
            region: reseller.region ?? "Unknown",
            created_at: reseller.created_at ?? "",
            total_products_sold: reseller.total_products_sold ?? 0,
            payment_status: totalRemaining === 0 ? "clear" : "pending",
            payment_amount_remaining: totalRemaining,
            total_revenue_generated: totalRevenue,
            reward_points: rewardPoints,
            is_active: reseller.is_active ?? false,
            flagged_status: reseller.flagged_status ?? false,
            exclusive_features: reseller.exclusive_features ?? '',
            coverage: reseller.coverage ?? 0,
            sub_active_resellers: subActiveResellers,
            sub_passive_resellers: subPassiveResellers,
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

  useEffect(() => {
    fetchResellers();

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

useEffect(() => {
  if (selectedReseller) {
    setEditableResellerName(selectedReseller.name || '');
    setEditableRegion(selectedReseller.region || '');
    setEditableCoverage(selectedReseller.coverage ?? '');
    setExclusiveFeatures(selectedReseller.exclusive_features || '');
    setIsLoginAccessEnabled(selectedReseller.is_active);
    fetchResellerDetails(selectedReseller.id);
    fetchResellerSalesData(selectedReseller.id);
  }
}, [selectedReseller]);

const fetchResellerSalesData = async (resellerId: string) => {
  if (!resellerId) {
    console.warn("Missing resellerId");
    return;
  }

  const { data: sales, error } = await supabase
    .from('sales')
    .select('date, total, paid') // ✅ match your column names exactly
    .eq('reseller_id', resellerId)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching sales:', error);
    return;
  }

  if (!sales || sales.length === 0) {
    console.warn('No sales found for reseller:', resellerId);
    return;
  }

  console.log('Fetched sales:', sales);
  setResellerSales(sales); // For the sales history table

  // Build monthly revenue chart data
  const monthlyRevenue: Record<string, number> = {};
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  sales.forEach(s => {
    const d = new Date(s.date); // ✅ use 'date' column
    if (isNaN(d.getTime())) return;

    const key = `${monthNames[d.getMonth()]} '${d.getFullYear().toString().slice(-2)}`;
    monthlyRevenue[key] = (monthlyRevenue[key] || 0) + (s.total ?? 0);
  });

  const formatted = Object.entries(monthlyRevenue)
    .map(([month, revenue]) => {
      const [monStr, yearStr] = month.split(' ');
      const monthIndex = monthNames.indexOf(monStr);
      const fullYear = 2000 + parseInt(yearStr.replace("'", ''));
      const date = new Date(fullYear, monthIndex);
      return { month, revenue, date };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(({ month, revenue }) => ({ month, revenue }));

  setChartData(formatted); // ✅ chart-ready data
};


const fetchResellerDetails = async (resellerId: string) => {
    try {
      const { data: requests, error: requestsError } = await supabase
        .from('requests')
        .select('*')
        .eq('reseller_id', resellerId)
        .order('request_date', { ascending: false });

      if (requestsError) throw requestsError;
      setResellerRequests(requests as Request[]);
      console.log(requests)
      
    } catch (error: any) {
      console.error('Error fetching reseller details:', error);
      toast({
        title: "Error",
        description: "Failed to fetch reseller details",
        variant: "destructive",
      });
    }
  };

  // --- Add Reseller Form Component (within AdminResellers) ---
  const AddResellerForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState({
      name: '',
      email: '',
      phone: '',
      region: '',
      coverage: 0,
    });
    const [submitting, setSubmitting] = useState(false);
    const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

    const handleAddResellerSubmit = async () => {
      const { name, email, phone, region, coverage } = formData;

      // --- MODIFICATION: Only 'name' is required here ---
      if (!name) {
        toast({
          title: "Missing Information",
          description: "Reseller Name is required.",
          variant: "destructive",
        });
        return;
      }

      setSubmitting(true);
      setGeneratedPassword(null);
      try {
        const sessionResult = await supabase.auth.getSession();
        const accessToken = sessionResult.data.session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
        console.log("Triggers")
        const response = await fetch(import.meta.env.VITE_ADD_RESELLER_FUNCTION_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            name,
            email: email === '' ? null : email,
            phone: phone === '' ? null : phone, // Send null if phone is empty
            region: region === '' ? null : region, // Send null if region is empty
            coverage,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to add reseller via backend service.");
        }

        if (result.generated_password) {
          setGeneratedPassword(result.generated_password);
          toast({
            title: "Reseller Added!",
            description: "A new reseller account has been created successfully. Please provide the following temporary password to the reseller:",
            duration: 15000,
            action: (
              <Button onClick={() => navigator.clipboard.writeText(result.generated_password)}>
                Copy Password
              </Button>
            ),
          });
        } else {
          toast({
            title: "Success",
            description: "New reseller added successfully!",
          });
        }

        setFormData({ name: '', email: '', phone: '', region: '', coverage: 0 });

      } catch (error: any) {
        console.error('Error adding reseller:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to add reseller.",
          variant: "destructive",
        });
      } finally {
        setSubmitting(false);
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
      <div className="space-y-4 py-4">
        <Input
          required // Only name is required now
          name="name"
          placeholder="Reseller Name"
          value={formData.name}
          onChange={handleChange}
        />
        <Input
          name="email"
          type="email"
          placeholder="Email (optional)"
          value={formData.email}
          onChange={handleChange}
        />
        <Input
          name="phone"
          type="tel"
          placeholder="Phone (optional)" // Explicitly optional
          value={formData.phone}
          onChange={handleChange}
        />
        <Input
          name="region"
          placeholder="Region (optional)" // Explicitly optional
          value={formData.region}
          onChange={handleChange}
        />
        <Input
          name="coverage"
          type="number"
          placeholder="Coverage (number of sub-resellers) (optional)" // Explicitly optional
          value={formData.coverage}
          onChange={(e) => setFormData(prev => ({ ...prev, coverage: parseInt(e.target.value) || 0 }))}
        />
        <Button onClick={handleAddResellerSubmit} disabled={submitting} className="w-full">
          {submitting ? "Adding..." : "Add Reseller"}
        </Button>

        {generatedPassword && (
          <div className="mt-6 p-4 border-2 border-dashed border-primary/50 rounded-lg bg-primary-foreground/5 dark:bg-accent/10">
            <p className="font-semibold text-lg text-primary mb-2">Initial Password:</p>
            <div className="flex items-center justify-between gap-2 bg-muted p-3 rounded-md border text-foreground">
              <span className="font-mono text-xl flex-grow break-all pr-2">{generatedPassword}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(generatedPassword);
                  toast({ title: "Copied!", description: "Password copied to clipboard.", duration: 2000 });
                }}
              >
                Copy
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Please provide this password to the new reseller for their first login. They will be prompted to change it.
            </p>
          </div>
        )}
        {generatedPassword && (
          <DialogClose asChild>
            <Button variant="secondary" className="w-full mt-2" onClick={onClose}>
              Done
            </Button>
          </DialogClose>
        )}
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

      await supabase
        .from('notifications')
        .insert({
          user_id: selectedReseller?.id,
          type: 'request_status_update',
          message: `Your request has been ${newStatus.toLowerCase()}. Request ID: ${requestId.slice(0, 8)}`,
          related_entity_id: requestId,
          role: 'reseller'
        });

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
      // It's generally better to only update the specific field.
      // If region is null, updating it with null should be fine if DB allows.
      const { error } = await supabase
        .from('users')
        .update({ flagged_status: !currentStatus })
        .eq('id', resellerId);

      if (error) throw error;

      setResellers(prev =>
        prev.map(r =>
          r.id === resellerId ? { ...r, flagged_status: !currentStatus } : r
        )
      );
      if (selectedReseller?.id === resellerId) {
        setSelectedReseller(prev => prev ? { ...prev, flagged_status: !currentStatus } : null);
      }

      toast({
        title: "Success",
        description: `Reseller ${!currentStatus ? 'flagged' : 'unflagged'} successfully.`,
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

  const handleToggleLoginAccess = async (resellerId: string, currentStatus: boolean) => {
    try {
      // Similarly, only update is_active. Rely on the DB to handle other fields correctly.
      const { error } = await supabase
        .from('users')
        .update({ is_active: !currentStatus })
        .eq('id', resellerId);

      if (error) throw error;

      setResellers(prev =>
        prev.map(r =>
          r.id === resellerId ? { ...r, is_active: !currentStatus } : r
        )
      );
      if (selectedReseller?.id === resellerId) {
        setSelectedReseller(prev => prev ? { ...prev, is_active: !currentStatus } : null);
        setIsLoginAccessEnabled(!currentStatus);
      }

      toast({
        title: "Success",
        description: `Reseller login access ${!currentStatus ? 'enabled' : 'disabled'} successfully.`,
      });
    } catch (error: any) {
      console.error('Error toggling login access:', error);
      toast({
        title: "Error",
        description: "Failed to update login access",
        variant: "destructive",
      });
    }
  };

//New update reseller
const handleUpdateResellerDetails = async () => {
  if (!selectedReseller) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) throw new Error("Not authenticated");

    const updatesPayload: any = {
      name: editableResellerName,
      region: editableRegion,
      coverage: editableCoverage === '' ? 0 : editableCoverage,
    };

    if (editableEmail !== selectedReseller.email) {
      updatesPayload.email = editableEmail;
    }

    const response = await fetch(import.meta.env.VITE_UPDATE_RESELLER_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        userId: selectedReseller.id,
        updates: updatesPayload,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Failed to update reseller.");
    }

    toast({
      title: "Success",
      description: "Reseller details updated successfully.",
    });

    setDetailsOpen(false);
  } catch (error: any) {
    console.error('Error updating reseller details:', error);
    toast({
      title: "Error",
      description: error.message || "Failed to update reseller details.",
      variant: "destructive",
    });
  }
};

  const filteredResellers = resellers.filter(reseller =>
    reseller.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reseller.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reseller.region?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reseller.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Approved': 'bg-green-100 text-green-800',
      'Rejected': 'bg-red-100 text-red-800',
      'Shipped': 'bg-blue-100 text-blue-800',
      'Completed': 'bg-purple-100 text-purple-800',
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-100px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="ml-4 text-lg text-muted-foreground">Loading resellers...</p>
      </div>
    );
  }
  return (
    <div className="space-y-6 p-6">
  
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold text-foreground">Reseller Management</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="w-full md:w-auto">+ Add Reseller</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Reseller</DialogTitle>
            </DialogHeader>
            {/* Pass onClose prop to the AddResellerForm so it can close itself */}
            <AddResellerForm onClose={() => setDetailsOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Resellers</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{resellers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Resellers</CardTitle>
            <UserCheck className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{resellers.filter(r => r.is_active).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Passive Resellers</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {resellers.filter(r => r.is_active).reduce((sum, r) => sum + (r.coverage || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Due Amount</CardTitle>
            <XCircle className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${resellers.reduce((sum, r) => sum + r.payment_amount_remaining, 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Search and Resellers Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, region, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-lg"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Name</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Total Packages Sold</TableHead>
                  <TableHead>Total Revenue Generated</TableHead>
                  <TableHead>Total Outstanding</TableHead>
                  <TableHead>Current RP</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResellers.length > 0 ? (
                  filteredResellers.map((reseller) => {
                    const tierInfo = getTierInfo(reseller.total_products_sold);
                    return (
                      <TableRow key={reseller.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {reseller.is_active ? (
                              <span title="Verified (Login Enabled)">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              </span>
                            ) : (
                              <span title="Not Verified (Login Disabled)">
                                <XCircle className="h-4 w-4 text-gray-400" />
                              </span>
                            )}
                            {reseller.name}
                          </div>
                        </TableCell>
                        <TableCell>{reseller.region}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <TierIcon svgName={tierInfo.svg} tier={tierInfo.tier} />
                            <span className="text-sm">{tierInfo.tier}</span>
                          </div>
                        </TableCell>
                        <TableCell>{reseller.total_products_sold}</TableCell>
                        <TableCell>${reseller.total_revenue_generated?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              reseller.payment_status === "clear"
                                ? "bg-green-100 text-green-800 hover:bg-green-100"
                                : "bg-red-100 text-red-800 hover:bg-red-100"
                            }
                          >
                            ${reseller.payment_amount_remaining.toFixed(2)}
                          </Badge>
                        </TableCell>
                        <TableCell>{reseller.reward_points || 0}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={reseller.is_active ? "default" : "secondary"}>
                            {reseller.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {reseller.flagged_status && (
                            <Badge variant="destructive" className="ml-2">Flagged</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Dialog open={detailsOpen && selectedReseller?.id === reseller.id} onOpenChange={setDetailsOpen}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedReseller(reseller)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Details
                              </Button>
                            </DialogTrigger>

                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  Reseller Details - {selectedReseller?.name}
                                  {selectedReseller && (
                                    <TierIcon
                                      svgName={getTierInfo(selectedReseller.total_products_sold).svg}
                                      tier={getTierInfo(selectedReseller.total_products_sold).tier}
                                    />
                                  )}
                                </DialogTitle>
                              </DialogHeader>

                              {selectedReseller && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                                  {/* Basic Information & Editing */}
                                  <div className="space-y-4 border rounded-lg p-4">
                                    <h3 className="text-lg font-semibold mb-2">Basic Information</h3>
                                    <InfoItem label="Reseller ID" value={`${selectedReseller.name?.replace(/\s/g, '') || ''}-${selectedReseller.region?.replace(/\s/g, '') || ''}-${selectedReseller.id.slice(0, 4)}`} />

                                    <div>
                                      <Label htmlFor="reseller-name">Name</Label>
                                      <Input
                                        id="reseller-name"
                                        value={editableResellerName}
                                        onChange={(e) => setEditableResellerName(e.target.value)}
                                        className="mt-1"
                                      />
                                    </div>
                                    <InfoItem label="Username" value="Set by reseller on first login" />
                                    <InfoItem label="Email" value={selectedReseller.email || "Initially empty; set by reseller on first login"} />
                                    <InfoItem label="Phone Number" value={selectedReseller.contact_info?.phone || "Initially empty; compulsory on first login"} />

                                    <div>
                                      <Label htmlFor="reseller-region">Region</Label>
                                      <Input
                                        id="reseller-region"
                                        value={editableRegion}
                                        onChange={(e) => setEditableRegion(e.target.value)}
                                        className="mt-1"
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="reseller-tier">Tier (Calculated)</Label>
                                      <Input
                                        id="reseller-tier"
                                        value={getTierInfo(selectedReseller.total_products_sold).tier}
                                        disabled
                                        className="mt-1 bg-muted"
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="reseller-coverage">Coverage</Label>
                                      <Input
                                        id="reseller-coverage"
                                        type="number"
                                        value={editableCoverage}
                                        onChange={(e) => setEditableCoverage(e.target.value === '' ? '' : parseInt(e.target.value))}
                                        placeholder="Number of sub-resellers"
                                        className="mt-1"
                                      />
                                    </div>

                                    <InfoItem label="Active Resellers (Sub-hierarchy)" value={selectedReseller.sub_active_resellers || 0} />
                                    <InfoItem label="Passive Resellers (Sub-hierarchy)" value={selectedReseller.sub_passive_resellers || 0} />

                                    <Button onClick={handleUpdateResellerDetails} className="w-full">
                                      Save Basic Info
                                    </Button>
                                  </div>

                                    {/* Financial & Performance Section */}
                                    <div className="space-y-4 border rounded-lg p-4">
                                      <h3 className="text-lg font-semibold mb-2">Financial & Performance</h3>
                                      <InfoItem label="Total Packages Sold" value={selectedReseller.total_products_sold} />
                                      <InfoItem label="Total Revenue Generated" value={`$${selectedReseller.total_revenue_generated?.toFixed(2) ?? '0.00'}`} />
                                      <InfoItem label="Due/Outstanding Balance" value={`$${selectedReseller.payment_amount_remaining.toFixed(2)}`} />
                                      <InfoItem label="Reward Points (RP)" value={selectedReseller.reward_points ?? 0} />

                                      <div className="mt-4 p-4 border rounded-md">
                                        <h4 className="text-md font-medium mb-2">Revenue Progress (last months)</h4>
                                        {chartData.length > 0 ? (
                                          <ResponsiveContainer width="100%" height={200}>
                                            <LineChart data={chartData}>
                                              <CartesianGrid strokeDasharray="3 3" />
                                              <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                                              <YAxis fontSize={12} tickFormatter={(v) => `$${v}`} />
                                              <Tooltip />
                                              <Legend />
                                              <Line type="monotone" dataKey="revenue" stroke="#8884d8" activeDot={{ r: 6 }} />
                                            </LineChart>
                                          </ResponsiveContainer>
                                        ) : (
                                          <div className="h-32 flex items-center justify-center text-muted-foreground">
                                            No sales data.
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Recent Sales Table */}
                                    <div className="mt-6">
                                      <h3 className="text-lg font-semibold mb-2">Recent Sales</h3>
                                      <Card>
                                        <CardContent className="p-0">
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Total</TableHead>
                                                <TableHead className="text-right">Paid</TableHead>
                                                <TableHead className="text-right">Balance</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {resellerSales.length > 0 ? resellerSales.map((sale) => (
                                                <TableRow key={sale.id}>
                                                  <TableCell>{new Date(sale.request_date).toLocaleDateString()}</TableCell>
                                                  <TableCell><Badge>{sale.status}</Badge></TableCell>
                                                  <TableCell className="text-right">${sale.total_amount.toFixed(2)}</TableCell>
                                                  <TableCell className="text-right">${sale.amount_paid.toFixed(2)}</TableCell>
                                                  <TableCell className="text-right font-medium">${(sale.total_amount - sale.amount_paid).toFixed(2)}</TableCell>
                                                </TableRow>
                                              )) : (
                                                <TableRow>
                                                  <TableCell colSpan={5} className="text-center h-24">No sales found.</TableCell>
                                                </TableRow>
                                              )}
                                            </TableBody>
                                          </Table>
                                        </CardContent>
                                      </Card>
                                    </div>

                                </div>
                              )}

                              {/* Requests */}
                              <div className="mt-6 border rounded-lg p-4">
                                <h3 className="text-lg font-semibold mb-3">
                                  Recent Requests ({resellerRequests.length})
                                </h3>
                                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                                  {resellerRequests.length > 0 ? (
                                    resellerRequests.map((request) => (
                                      <div
                                        key={request.id}
                                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 border rounded-md bg-card shadow-sm"
                                      >
                                        <div className="flex-1">
                                          <div className="flex items-center space-x-2 mb-1 sm:mb-0">
                                            <span className="font-medium text-primary">
                                              #{request.id.slice(0, 8)}
                                            </span>
                                            <Badge className={getStatusBadge(request.status)}>
                                              {request.status}
                                            </Badge>
                                          </div>
                                          <p className="text-sm text-muted-foreground">
                                            Amount: ${request.total_amount.toFixed(2)} | Date:{" "}
                                            {new Date(request.request_date).toLocaleDateString()}
                                          </p>
                                          {request.special_instructions && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                              Special Instructions: {request.special_instructions}
                                            </p>
                                          )}
                                        </div>
                                        {request.status === "Pending" && (
                                          <div className="flex space-x-2 flex-shrink-0">
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
                                      No requests found for this reseller.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      No resellers found matching your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminResellers;