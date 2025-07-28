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
import { Switch } from '@/components/ui/switch'; // Assuming you have this from shadcn/ui
import { Label } from '@/components/ui/label'; // Assuming you have this from shadcn/ui
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'; // Assuming you have this from shadcn/ui
import { Eye, Flag, FlagOff, Search, Users, UserCheck,CheckCircle2, XCircle } from 'lucide-react';

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

// Define the return type for getTierInfo
type TierInfo = {
  tier: string;
  svg: string | null; // Path to SVG, e.g., 'bronze.svg'
};

// Function to convert number to Roman numeral
const toRomanNumeral = (num: number): string => {
  const romanNumerals: { [key: number]: string } = {
    1: "I", 2: "II", 3: "III"
  };
  return romanNumerals[num] || "";
};

// Function to get tier info based on total sold (simplified for example)
// You might want to adjust these thresholds and tier names based on your actual business logic
const getTierInfo = (totalSold: number): TierInfo => {
  if (totalSold < 1000) return { tier: "Base", svg: "Base" };
  if (totalSold < 2000) return { tier: "Bronze", svg: "Bronze" };
  if (totalSold < 4000) return { tier: "Silver I", svg: "Silver" }; // Changed to Roman for consistency
  if (totalSold < 6000) return { tier: "Silver II", svg: "Silver" };
  if (totalSold < 10000) return { tier: "Silver III", svg: "Silver" };
  if (totalSold < 15000) return { tier: "Gold I", svg: "Gold" };
  if (totalSold < 20000) return { tier: "Gold II", svg: "Gold" };
  if (totalSold < 26000) return { tier: "Gold III", svg: "Gold" };
  if (totalSold < 32000) return { tier: "Crystal I", svg: "Crystal" }; // New tier name for clarity
  if (totalSold < 38000) return { tier: "Crystal II", svg: "Crystal" };
  if (totalSold < 45000) return { tier: "Crystal III", svg: "Crystal" };
  return { tier: "Diamond", svg: "Diamond" };
};

// Props for TierIcon component
interface TierIconProps {
  svgName: string | null;
  tier: string;
}

// Component to render tier icon
const TierIcon: React.FC<TierIconProps> = ({ svgName, tier }) => {
  if (!svgName) return null;

  const tierParts = tier.split(' ');
  const mainTier = tierParts[0];
  const romanNumeral = tierParts.length > 1 ? toRomanNumeral(parseInt(tierParts[1])) : null;

  return (
    <div className="flex flex-col items-center gap-1 relative" title={tier}>
      <div className='relative'>
        {/* Make sure the SVG path is correct, e.g., /tier/Bronze.svg */}
        <img
          src={`/tier/${mainTier}.svg`}
          alt={`${tier} tier`}
          className="w-9 h-9"
        />
        {romanNumeral && (
          <span className="text-xs absolute -bottom-1 -right-0 font-medium bg-primary text-primary-foreground p-[1px] rounded-full min-w-[18px] text-center">
            {romanNumeral}
          </span>
        )}
      </div>
      {/* <span className="text-xs font-normal">
        {tier}
      </span> */}
    </div>
  );
};

const AdminResellers: React.FC = () => {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [selectedReseller, setSelectedReseller] = useState<Reseller | null>(null);
  const [resellerRequests, setResellerRequests] = useState<Request[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Editable fields for reseller details
  const [editableResellerName, setEditableResellerName] = useState('');
  const [editableRegion, setEditableRegion] = useState('');
  const [editableTier, setEditableTier] = useState('');
  const [editableCoverage, setEditableCoverage] = useState<number | ''>('');
  const [exclusiveFeatures, setExclusiveFeatures] = useState('');
  const [isLoginAccessEnabled, setIsLoginAccessEnabled] = useState(false); // For "Enable Login Access" toggle

  const { toast } = useToast();

  const fetchResellers = async () => {
    setLoading(true);
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
              name: reseller.name ?? "Unnamed",
              region: reseller.region ?? "Unknown",
              created_at: reseller.created_at ?? "",
              total_products_sold: reseller.total_products_sold ?? 0,
              payment_status: 'pending',
              payment_amount_remaining: 0,
              total_revenue_generated: 0, // Default to 0 if no sales data
              reward_points: 0, // Default to 0
              is_active: reseller.is_active ?? false, // Ensure this is boolean
              flagged_status: reseller.flagged_status ?? false, // Ensure this is boolean
            } as Reseller;
          }

          let totalRemaining = 0;
          let totalRevenue = 0;
          let totalGrossProfit = 0; // For reward points calculation

          for (const req of requests) {
            const total = req.total_amount ?? 0;
            const paid = req.amount_paid ?? 0;
            totalRemaining += Math.max(0, total - paid);
            totalRevenue += total;

            // Assuming 'products_ordered' in request contains info for gross profit
            // This is a placeholder; you'd need to fetch actual product details (gross_profit)
            // or have it denormalized in the request itself.
            // For now, let's just make a dummy calculation or fetch if product data is available.
            // Example: if `req.products_ordered` is an array of `{ product_id: string, qty: number, gross_profit_per_unit: number }`
            // totalGrossProfit += req.products_ordered.reduce((sum: number, p: any) => sum + (p.gross_profit_per_unit * p.qty), 0);
          }

          // Placeholder for RP calculation: (SUM(product.gross_profit * product.qty_sold_by_reseller)) / 5
          // Since we don't have direct product gross profit here, we'll use a simplified example
          // In a real scenario, you'd calculate this from detailed sales items
          const rewardPoints = Math.floor(totalRevenue / 100); // Example: 1 RP for every $100 revenue

          // Placeholder for sub-hierarchy counts (would need additional database queries or pre-calculated fields)
          const subActiveResellers = 0;
          const subPassiveResellers = 0;

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
            coverage: reseller.coverage ?? 0, // Assuming 'coverage' field exists in 'users' table
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
          fetchResellers(); // Re-fetch all data on any change
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [toast]);

  // Update editable fields when a reseller is selected
  useEffect(() => {
    if (selectedReseller) {
      setEditableResellerName(selectedReseller.name || '');
      setEditableRegion(selectedReseller.region || '');
      // Determine the current tier string based on total_products_sold
      const currentTierInfo = getTierInfo(selectedReseller.total_products_sold);
      setEditableTier(currentTierInfo.tier);
      setEditableCoverage(selectedReseller.coverage ?? '');
      setExclusiveFeatures(selectedReseller.exclusive_features || '');
      setIsLoginAccessEnabled(selectedReseller.is_active);
      fetchResellerDetails(selectedReseller.id);
    }
  }, [selectedReseller]);

  const fetchResellerDetails = async (resellerId: string) => {
    try {
      const { data: requests, error: requestsError } = await supabase
        .from('requests')
        .select('*')
        .eq('reseller_id', resellerId)
        .order('request_date', { ascending: false });

      if (requestsError) throw requestsError;
      setResellerRequests(requests as Request[]);

    } catch (error: any) {
      console.error('Error fetching reseller details:', error);
      toast({
        title: "Error",
        description: "Failed to fetch reseller details",
        variant: "destructive",
      });
    }
  };

  const AddResellerForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState({
      name: '',
      email: '',
      phone: '',
      region: '',
    });
    const [loading, setLoading] = useState(false);

    const handleAddReseller = async (
      name: string,
      email: string,
      phone: string,
      region: string
    ) => {
      const resellerData = {
        name: name,
        email: email,
        phone: phone,
        region: region
      };

      try {
        const response = await fetch(`https://virbnugthhbunxxxsizw.functions.supabase.co/createReseller`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(resellerData),
        });

        const result = await response.json();
        console.log(result);

        if (!response.ok) {
          throw new Error(result.error || "Failed to add reseller via Edge Function.");
        }
        return true;
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }
    };

    const handleSubmit = async () => {
      const { name, email, phone, region } = formData;

      if (!name || !region) { // Region is now required
        toast({
          title: "Missing Information",
          description: "Name and Region are required to add a reseller.",
          variant: "destructive",
        });
        return;
      }

      setLoading(true);
      try {
        let status = await handleAddReseller(name, email, phone, region);

        if (!status) {
          setLoading(false);
          return;
        }

        toast({
          title: "Success",
          description: "New reseller added successfully!",
        });

        setFormData({ name: '', email: '', phone: '', region: '' });
        onClose(); // Close the dialog on success
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
      <div className="space-y-4 py-4">
        <Input
          required
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
          placeholder="Phone (optional)"
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
      const { error } = await supabase
        .from('users')
        .update({ flagged_status: !currentStatus }) // Toggle the status
        .eq('id', resellerId);

      if (error) throw error;

      // Update the local state to reflect the change immediately
      setResellers(prev =>
        prev.map(r =>
          r.id === resellerId ? { ...r, flagged_status: !currentStatus } : r
        )
      );
      // Also update selectedReseller if it's the one being flagged
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
      const { error } = await supabase
        .from('users')
        .update({ is_active: !currentStatus }) // Toggle login access
        .eq('id', resellerId);

      if (error) throw error;

      setResellers(prev =>
        prev.map(r =>
          r.id === resellerId ? { ...r, is_active: !currentStatus } : r
        )
      );
      if (selectedReseller?.id === resellerId) {
        setSelectedReseller(prev => prev ? { ...prev, is_active: !currentStatus } : null);
        setIsLoginAccessEnabled(!currentStatus); // Update local state for toggle
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

  const handleUpdateResellerDetails = async () => {
    if (!selectedReseller) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: editableResellerName,
          region: editableRegion,
          coverage: editableCoverage === '' ? null : editableCoverage, // Set to null if empty
          // Tier is derived from total_products_sold, so it's not directly editable.
          // If you *do* want to directly set tier, you'd need a separate field for it.
          // Assuming here it's read-only based on sales performance.
        })
        .eq('id', selectedReseller.id);

      if (error) throw error;

      // Update local state and trigger re-fetch for comprehensive data refresh
      setResellers(prev =>
        prev.map(r =>
          r.id === selectedReseller.id ? {
            ...r,
            name: editableResellerName,
            region: editableRegion,
            coverage: editableCoverage === '' ? null : editableCoverage,
          } : r
        )
      );
      // Update selected reseller's local state immediately for UI refresh
      setSelectedReseller(prev => prev ? {
        ...prev,
        name: editableResellerName,
        region: editableRegion,
        coverage: editableCoverage === '' ? null : editableCoverage,
      } : null);


      toast({
        title: "Success",
        description: "Reseller details updated successfully.",
      });
    } catch (error: any) {
      console.error('Error updating reseller details:', error);
      toast({
        title: "Error",
        description: "Failed to update reseller details.",
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
          region: selectedReseller.region ?? null,
        })
        .eq('id', selectedReseller.id);

      if (error) throw error;

      setResellers(prev =>
        prev.map(r =>
          r.id === selectedReseller.id ? { ...r, exclusive_features: exclusiveFeatures } : r
        )
      );
      setSelectedReseller(prev => prev ? { ...prev, exclusive_features: exclusiveFeatures } : null);


      toast({
        title: "Success",
        description: "Exclusive features updated successfully.",
      });
    } catch (error: any) {
      console.error('Error updating exclusive features:', error);
      toast({
        title: "Error",
        description: "Failed to update exclusive features.",
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
      'Completed': 'bg-purple-100 text-purple-800', // Example for a new status
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
            <AddResellerForm onClose={() => setDetailsOpen(false)} /> {/* Pass onClose to close dialog */}
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
            {/* Active Resellers: A count of how many individual resellers have bought from you in the selected time frame. */}
            {/* For this example, we'll count `is_active` status from `users` table. For a "bought in timeframe" KPI, you'd need to link to sales data with date filtering. */}
            <div className="text-3xl font-bold">{resellers.filter(r => r.is_active).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Passive Resellers</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {/* This formula SUM(resellers.coverage) WHERE resellers.id IN (SELECT DISTINCT sales.member_id FROM sales within the selected date range) requires more complex data.
                For demonstration, we'll sum 'coverage' for all active resellers. You'd refine this with actual 'active within timeframe' logic. */}
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

      

      {/* Search and Table */}
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
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-gray-400" />
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
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
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
                                    <InfoItem label="Reseller ID" value={`${selectedReseller.name?.replace(/\s/g, '')}-${selectedReseller.region?.replace(/\s/g, '')}-${selectedReseller.id.slice(0, 4)}`} /> {/* Auto-generated ID */}

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
                                        disabled // Tier is calculated, not directly editable
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

                                    {/* Placeholder for sub-hierarchy data */}
                                    <InfoItem label="Active Resellers (Sub-hierarchy)" value={selectedReseller.sub_active_resellers || 0} />
                                    <InfoItem label="Passive Resellers (Sub-hierarchy)" value={selectedReseller.sub_passive_resellers || 0} />

                                    <Button onClick={handleUpdateResellerDetails} className="w-full">
                                      Save Basic Info
                                    </Button>
                                  </div>

                                  {/* Financial & Performance Data / Actions */}
                                  <div className="space-y-4">
                                    <div className="space-y-4 border rounded-lg p-4">
                                      <h3 className="text-lg font-semibold mb-2">Financial & Performance</h3>
                                      <InfoItem label="Total Packages Sold" value={selectedReseller.total_products_sold} />
                                      <InfoItem label="Total Revenue Generated" value={`$${selectedReseller.total_revenue_generated?.toFixed(2) || '0.00'}`} />
                                      <InfoItem label="Due/Outstanding Balance" value={`$${selectedReseller.payment_amount_remaining.toFixed(2)}`} />
                                      <InfoItem label="Reward Points (RP)" value={selectedReseller.reward_points || 0} />

                                      {/* Placeholder for Revenue Progress Graph */}
                                      <div className="mt-4 p-4 border rounded-md bg-muted/20">
                                        <h4 className="text-md font-medium mb-2">Revenue Progress Graph</h4>
                                        <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                                          [Revenue Graph Placeholder]
                                          {/* Integrate a charting library here, e.g., Recharts or Chart.js */}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Exclusive Features */}
                                    <div className="space-y-2 border rounded-lg p-4">
                                      <h3 className="text-lg font-semibold mb-2">Exclusive Features</h3>
                                      <Textarea
                                        value={exclusiveFeatures}
                                        onChange={(e) => setExclusiveFeatures(e.target.value)}
                                        placeholder="Enter exclusive features for this reseller..."
                                        className="min-h-[100px]"
                                      />
                                      <Button onClick={handleUpdateExclusiveFeatures} size="sm" className="w-full">
                                        Save Features
                                      </Button>
                                    </div>

                                    {/* Login Access & Verification */}
                                    <div className="space-y-2 border rounded-lg p-4">
                                      <h3 className="text-lg font-semibold mb-2">Login Access & Verification</h3>
                                      <div className="flex items-center justify-between">
                                        <Label htmlFor="login-access" className="text-base">
                                          Enable Login Access (Verified)
                                        </Label>
                                        <Switch
                                          id="login-access"
                                          checked={isLoginAccessEnabled}
                                          onCheckedChange={() => handleToggleLoginAccess(selectedReseller.id, isLoginAccessEnabled)}
                                        />
                                      </div>
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {isLoginAccessEnabled ? "Reseller account is enabled for login." : "Reseller cannot log in. First-time login process will apply if enabled."}
                                      </p>
                                      {/* Flag Action */}
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button
                                            variant={
                                              selectedReseller.flagged_status
                                                ? "destructive"
                                                : "outline"
                                            }
                                            size="sm"
                                            className="w-full mt-4"
                                          >
                                            {selectedReseller.flagged_status ? (
                                              <FlagOff className="h-4 w-4 mr-1" />
                                            ) : (
                                              <Flag className="h-4 w-4 mr-1" />
                                            )}
                                            {selectedReseller.flagged_status
                                              ? "Unflag Reseller"
                                              : "Flag Reseller"}
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
                                              <span className="font-bold">
                                                {selectedReseller.flagged_status ? "unflag" : "flag"}
                                              </span>{" "}
                                              {selectedReseller.name}? This action can be reversed.
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