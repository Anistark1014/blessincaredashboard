import { useEffect, useState, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient'; // Ensure this is your client-side Supabase instance
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Eye, Search, Users, UserCheck, CheckCircle2, XCircle, Upload, Download, HandCoins } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer
} from 'recharts';
import * as XLSX from 'xlsx';
// import { saveAs } from 'file-saver';
import { buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";


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
  sub_region: string | null;
  role: string;
  total_products_sold: number;
  payment_status: "pending" | "clear";
  payment_amount_remaining: number;
  total_revenue_generated?: number; // Added for KPI & table column
  reward_points: number | null; // Added for details view
  coverage?: number | null; // Added for details view (editable)
  sub_active_resellers?: number; // Placeholder for sub-hierarchy active resellers
  sub_passive_resellers?: number; // Placeholder for sub-hierarchy passive resellers
  // --- NEW: For main table date filtering (client-side) ---
  all_sales_data?: Sale[];
  all_clearance_data?: Clearance[];
}

// New interfaces for sales and clearance
interface Sale {
  created_at: string | null;
  date: string;
  id: string;
  member_id: string;
  outstanding: number;
  paid: number;
  payment_status: string;
  price: number;
  product_id: string | null;
  qty: number;
  total: number;
  gross_profit: number;
  transaction_type: string | null;
  type: string;
}

interface Clearance {
  created_at: string | null;
  date: string;
  id: string;
  member_id: string | null;
  paid_amount: number;
  status: string;
}

interface InfoItemProps {
  label: string;
  value: string | number | null | undefined;
}

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
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Sorting state for the main table
  const [sortKey, setSortKey] = useState<keyof Reseller | null>('name'); // Default to 'name'
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc'); // Default to ascending


  // Editable fields for reseller details (within the details dialog)
  const [editableResellerName, setEditableResellerName] = useState('');
  const [editableEmail, setEditableEmail] = useState('');
  const [editableRegion, setEditableRegion] = useState('');
  const [editableSubRegion, setEditableSubRegion] = useState('');
  const [editableCoverage, setEditableCoverage] = useState<number | ''>('');
  const [isLoginAccessEnabled, setIsLoginAccessEnabled] = useState(false);

  //Graph data (for selected reseller details)
  const [resellerSales, setResellerSales] = useState<Sale[]>([]);
  const [chartData, setChartData] = useState<{ month: string; revenue: number }[]>([]);

  // Manages the currently selected time range option for chart
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '3m' | 'lifetime' | 'custom'>('lifetime');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // New state for main table date filter
  const [mainTableTimeRange, setMainTableTimeRange] = useState<'lifetime' | '7d' | '30d' | '3m' | 'custom'>('lifetime');
  const [mainTableStartDate, setMainTableStartDate] = useState<string>('');
  const [mainTableEndDate, setMainTableEndDate] = useState<string>('');

  // New state for sales table in details dialog (month/year filter)
  const currentYear = new Date().getFullYear();
  const [salesTableMonth, setSalesTableMonth] = useState<string>((new Date().getMonth() + 1).toString());
  const [salesTableYear, setSalesTableYear] = useState<string>(currentYear.toString());


  const { toast } = useToast();

  const handleSort = (key: keyof Reseller) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };


  // Helper function to handle toggle login access
  const handleToggleLoginAccess = async (resellerId: string, currentStatus: boolean) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ is_active: !currentStatus })
        .eq('id', resellerId)
        .select();

      if (error) throw error;

      setIsLoginAccessEnabled(!currentStatus);
      toast({
        title: "Success",
        description: `Login access has been ${!currentStatus ? 'enabled' : 'disabled'}.`,
      });
      fetchResellers();
    } catch (error: any) {
      console.error('Error toggling login access:', error);
      toast({
        title: "Error",
        description: `Failed to toggle login access: ${error.message}`,
        variant: "destructive",
      });
    }
  };


  // Helper functions to fetch sales and clearance data for a specific member
  const fetchSalesByMemberId = useCallback(async (memberId: string): Promise<Sale[]> => {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('member_id', memberId)
      .order('date', { ascending: false }); // Ensure consistent order
    if (error) {
      console.error(`Error fetching sales for member ${memberId}:`, error);
      return [];
    }
    return data as Sale[];
  }, []); // No dependencies

  const fetchClearanceByMemberId = useCallback(async (memberId: string): Promise<Clearance[]> => {
    const { data, error } = await supabase
      .from('clearance')
      .select('*')
      .eq('member_id', memberId)
      .order('date', { ascending: false }); // Ensure consistent order
    if (error) {
      console.error(`Error fetching clearance for member ${memberId}:`, error);
      return [];
    }
    return data as Clearance[];
  }, []); // No dependencies


  const fetchResellers = useCallback(async () => {
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
          const salesData = await fetchSalesByMemberId(reseller.id);
          const clearanceData = await fetchClearanceByMemberId(reseller.id);

          let totalRevenue = 0;
          let RP = 0;
          let totalOutstanding = 0;
          let totalProductsSold = 0;

          // Sum paid from sales
          totalRevenue += salesData.reduce((sum, sale) => sum + (sale.total ?? 0), 0);
          RP += salesData.reduce((sum, sale) => sum + (sale.gross_profit ?? 0), 0);
          totalOutstanding += salesData.reduce((sum, sale) => sum + (sale.outstanding ?? 0), 0);
          totalProductsSold += salesData.reduce((sum, sale) => sum + (sale.qty ?? 0), 0);

          // Sum paid_amount from clearance
          totalRevenue += clearanceData.reduce((sum, clearance) => sum + (clearance.paid_amount ?? 0), 0);

          const rewardPoints = Math.floor(RP / 5);
          console.log(RP,rewardPoints)

          return {
            ...reseller,
            name: reseller.name ?? "Unnamed",
            email: reseller.email ?? null,
            contact_info: reseller.contact_info ?? null,
            region: reseller.region ?? "Unknown",
            sub_region: reseller.sub_region ?? "Unknown",
            created_at: reseller.created_at ?? "",
            total_products_sold: totalProductsSold,
            payment_status: totalOutstanding === 0 ? "clear" : "pending",
            payment_amount_remaining: totalOutstanding,
            total_revenue_generated: totalRevenue,
            reward_points: rewardPoints,
            is_active: reseller.is_active ?? false,
            flagged_status: reseller.flagged_status ?? false,
            exclusive_features: reseller.exclusive_features ?? null,
            coverage: reseller.coverage ?? 0,
            sub_active_resellers: reseller.sub_active_resellers ?? 0,
            sub_passive_resellers: reseller.sub_passive_resellers ?? 0,
            // Store all sales and clearance data for client-side filtering
            all_sales_data: salesData,
            all_clearance_data: clearanceData,
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
  }, [fetchSalesByMemberId, fetchClearanceByMemberId, toast]); // Dependencies for useCallback


  useEffect(() => {
    fetchResellers();

    const subscription = supabase
      .channel('resellers_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'users', filter: 'role=eq.reseller' },
        (payload) => {
          console.log('User change detected:', payload);
          fetchResellers();
        }
      )
      .subscribe();

    const salesSubscription = supabase
      .channel('sales_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        (payload) => {
          console.log('Sales change detected:', payload);
          // Re-fetch all resellers to update aggregates in main table
          fetchResellers();
          // If a reseller details dialog is open, update its specific sales data
          if (selectedReseller) {
            fetchResellerSalesData(selectedReseller.id);
          }
        }
      )
      .subscribe();

    const clearanceSubscription = supabase
      .channel('clearance_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'clearance' },
        (payload) => {
          console.log('Clearance change detected:', payload);
          // Re-fetch all resellers to update aggregates in main table
          fetchResellers();
          // No need to update specific reseller sales data for chart as it's only sales
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      salesSubscription.unsubscribe();
      clearanceSubscription.unsubscribe();
    };
  }, [fetchResellers, selectedReseller]); // Added selectedReseller and fetchResellers to dependency array for clarity and correctness

useEffect(() => {
  if (selectedReseller?.id) {
    fetchResellerSalesData(selectedReseller.id);
  }
}, [timeRange, customStartDate, customEndDate, selectedReseller?.id]);


  // Sales chart data fetching for selected reseller
  const fetchResellerSalesData = useCallback(async (resellerId: string) => {
    if (!resellerId) {
      console.warn("Missing resellerId");
      return;
    }

    let query = supabase
      .from('sales')
      .select('date, total, paid')
      .eq('member_id', resellerId);

    const now = new Date();
    let chartQueryStartDate: Date | null = null;
    let chartQueryEndDate: Date = now;

    if (timeRange === '7d') {
      chartQueryStartDate = new Date();
      chartQueryStartDate.setDate(now.getDate() - 7);
    } else if (timeRange === '30d') {
      chartQueryStartDate = new Date();
      chartQueryStartDate.setDate(now.getDate() - 30);
    } else if (timeRange === '3m') {
      chartQueryStartDate = new Date();
      chartQueryStartDate.setMonth(now.getMonth() - 3);
    } else if (timeRange === 'custom' && customStartDate && customEndDate) {
      chartQueryStartDate = new Date(customStartDate);
      chartQueryEndDate = new Date(customEndDate);
      // Ensure end date is inclusive of the whole day
      chartQueryEndDate.setHours(23, 59, 59, 999);
    }
    // For 'lifetime', no date filter needed for query

    if (chartQueryStartDate) {
      query = query.gte('date', chartQueryStartDate.toISOString().split('T')[0]); // Only date part
    }
    if (timeRange !== 'lifetime' && chartQueryEndDate) { // Apply end date filter only if not lifetime
        query = query.lte('date', chartQueryEndDate.toISOString().split('T')[0]); // Only date part
    }


    const { data: sales, error } = await query.order('date', { ascending: true });

    if (error) {
      console.error('Error fetching sales for chart:', error);
      setChartData([]);
      setResellerSales([]);
      return;
    }

    if (!sales || sales.length === 0) {
      console.warn('No sales found for reseller in the selected range:', resellerId);
      setChartData([]);
      setResellerSales([]);
      return;
    }

    setResellerSales([...sales].reverse() as Sale[]);

    let formattedChartData;
    const isDailyView = ['7d', '30d'].includes(timeRange) || (timeRange === 'custom' && customStartDate && customEndDate && (new Date(customEndDate).getTime() - new Date(customStartDate).getTime() < (90 * 24 * 60 * 60 * 1000))); // Less than 90 days for daily view

    if (isDailyView) {
      const dailyRevenue: Record<string, number> = {};
      sales.forEach(sale => {
        const dayKey = new Date(sale.date).toISOString().split('T')[0];
        dailyRevenue[dayKey] = (dailyRevenue[dayKey] || 0) + (sale.total ?? 0);
      });

      // Ensure all dates in range are present, even if no sales
      const datesInRange: string[] = [];
      let start = chartQueryStartDate ? new Date(chartQueryStartDate) : new Date(sales[0].date);
      const end = chartQueryEndDate;

      while (start.getTime() <= end.getTime()) {
        datesInRange.push(start.toISOString().split('T')[0]);
        start.setDate(start.getDate() + 1);
      }

      formattedChartData = datesInRange.map(dateKey => ({
        month: new Date(dateKey + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: dailyRevenue[dateKey] || 0,
      }));

    } else {
      const monthlyRevenue: Record<string, number> = {};
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      sales.forEach(sale => {
        const d = new Date(sale.date);
        if (isNaN(d.getTime())) return;
        const key = `${monthNames[d.getMonth()]} '${d.getFullYear().toString().slice(-2)}`;
        monthlyRevenue[key] = (monthlyRevenue[key] || 0) + (sale.total ?? 0);
      });

      formattedChartData = Object.entries(monthlyRevenue)
        .map(([month, revenue]) => {
          const [monStr, yearStr] = month.split(' ');
          const date = new Date(`${monStr} 1, 20${yearStr.replace("'", "")}`);
          return { month, revenue, date };
        })
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map(({ month, revenue }) => ({ month, revenue }));
    }

    setChartData(formattedChartData);
  }, [timeRange, customStartDate, customEndDate]);


  useEffect(() => {
    if (selectedReseller) {
      setEditableResellerName(selectedReseller.name || '');
      setEditableEmail(selectedReseller.email || '');
      setEditableRegion(selectedReseller.region || '');
      setEditableSubRegion(selectedReseller.sub_region || '');
      setEditableCoverage(selectedReseller.coverage ?? '');
      setIsLoginAccessEnabled(selectedReseller.is_active);

      // Reset chart filters when a new reseller is selected
      // setTimeRange('lifetime');
      setCustomStartDate('');
      setCustomEndDate('');
      setSalesTableMonth((new Date().getMonth() + 1).toString());
      setSalesTableYear(currentYear.toString());

      // Initial fetch for chart data with default filters
      fetchResellerSalesData(selectedReseller.id);
    } else {
      // Clear data if no reseller is selected (e.g., dialog closed)
      setEditableResellerName('');
      setEditableEmail('');
      setEditableRegion('');
      setEditableSubRegion('');
      setEditableCoverage('');
      setIsLoginAccessEnabled(false);
      setResellerSales([]);
      setChartData([]);
    }
  }, [selectedReseller, fetchResellerSalesData]);


  // Filter resellerSales for the table within the details dialog based on month/year
  const filteredResellerSalesForTable = useMemo(() => {
      if (!resellerSales || resellerSales.length === 0) return [];
      if (!salesTableYear) return resellerSales;

      return resellerSales.filter(sale => {
          const saleDate = new Date(sale.date);
          const isSelectedYear = saleDate.getFullYear() === parseInt(salesTableYear);

          // If 'salesTableMonth' is 'all', just check the year. Otherwise, check both month and year.
          if (salesTableMonth === 'all') {
              return isSelectedYear;
          } else {
              return (
                  saleDate.getMonth() + 1 === parseInt(salesTableMonth) &&
                  isSelectedYear
              );
          }
      });
  }, [resellerSales, salesTableMonth, salesTableYear]);


  const AddResellerForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { toast } = useToast();
    const [formData, setFormData] = useState({
      name: '',
      email: '',
      phone: '',
      region: '',
      sub_region: '',
      coverage: 0,
    });
    const [submitting, setSubmitting] = useState(false);
    const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

    const handleAddResellerSubmit = async () => {
      const { name, email, phone, region, coverage,sub_region } = formData;
      console.log('Form: ',formData);
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
        const response = await fetch(import.meta.env.VITE_ADD_RESELLER_FUNCTION_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            name,
            email: email === '' ? null : email,
            phone: phone === '' ? null : phone,
            region: region === '' ? null : region,
            sub_region: sub_region === '' ? null : sub_region,
            coverage,
          }),
        });

        const result = await response.json();
        console.log("response :",response)
        if (!response.ok) {
          throw new Error(result.error || "Failed to add reseller via backend service.");
        }

        if (result.generated_password) {
          setGeneratedPassword(result.generated_password);
          toast({
            title: "Reseller Added!",
            description: `A new reseller account has been created successfully. Temporary password: ${result.generated_password}`,
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

        setFormData({ name: '', email: '', phone: '', region: '',sub_region:'', coverage: 0 });
        fetchResellers(); // Re-fetch all resellers to update the main table
        // Close the dialog after submission and re-fetch if password wasn't generated (meaning user won't manually close it)
        if (!result.generated_password) {
          onClose();
        }

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
          name="region"
          placeholder="Region (optional)"
          value={formData.region}
          onChange={handleChange}
        />
        <Input
          name="sub_region"
          placeholder="Sub-Region (optional)"
          value={formData.sub_region}
          onChange={handleChange}
        />
        <Input
          name="coverage"
          type="number"
          placeholder="Coverage (number of sub-resellers) (optional)"
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
        {/* Only show "Done" button if a password was generated, allowing manual close */}
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


  const handleUpdateResellerDetails = async () => {
    if (!selectedReseller) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("Not authenticated");

      const updatesPayload: any = {
        name: editableResellerName,
        region: editableRegion,
        sub_region: editableSubRegion,
        coverage: editableCoverage === '' ? 0 : editableCoverage,
      };

      // Only include email in the payload if it has changed
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

      // Re-fetch all resellers to update the main table and selected reseller details
      await fetchResellers();
      // Update selectedReseller immediately to reflect changes in open dialog
      setSelectedReseller(prev => prev ? { ...prev, ...updatesPayload } : null);

      setDetailsOpen(false); // Close dialog after successful update
    } catch (error: any) {
      console.error('Error updating reseller details:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update reseller details.",
        variant: "destructive",
      });
    }
  };

const filteredResellers = useMemo(() => {
  let currentFiltered = resellers.filter(reseller =>
    reseller.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reseller.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reseller.region?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reseller.sub_region?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reseller.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (mainTableTimeRange !== 'lifetime') {
    let filterStartDate: Date | null = null;
    let filterEndDate: Date | null = null;

    const now = new Date();
    const today = new Date(now.toISOString().split('T')[0]);

    if (mainTableTimeRange === '7d') {
      filterStartDate = new Date(today);
      filterStartDate.setDate(today.getDate() - 7);
    } else if (mainTableTimeRange === '30d') {
      filterStartDate = new Date(today);
      filterStartDate.setDate(today.getDate() - 30);
    } else if (mainTableTimeRange === '3m') {
      filterStartDate = new Date(today);
      filterStartDate.setMonth(today.getMonth() - 3);
    } else if (
      mainTableTimeRange === 'custom' &&
      mainTableStartDate &&
      mainTableEndDate
    ) {
      filterStartDate = new Date(`${mainTableStartDate}T00:00:00Z`);
      filterEndDate = new Date(`${mainTableEndDate}T23:59:59.999Z`);
    }

    const isInRange = (dateStr: string) => {
      const date = new Date(`${dateStr}T00:00:00Z`);
      return (!filterStartDate || date >= filterStartDate) &&
             (!filterEndDate || date <= filterEndDate);
    };

    currentFiltered = currentFiltered
      .map(reseller => {
        const filteredSales = (reseller.all_sales_data || []).filter(sale => isInRange(sale.date));
        const filteredClearance = (reseller.all_clearance_data || []).filter(clearance => isInRange(clearance.date));

        const totalRevenue =
          filteredSales.reduce((sum, sale) => sum + (sale.paid ?? 0), 0) +
          filteredClearance.reduce((sum, c) => sum + (c.paid_amount ?? 0), 0);

        const totalOutstanding = filteredSales.reduce((sum, sale) => sum + (sale.outstanding ?? 0), 0);
        const totalProductsSold = filteredSales.reduce((sum, sale) => sum + (sale.qty ?? 0), 0);
        const rewardPoints = Math.floor(totalRevenue / 100);

        return {
          ...reseller,
          total_revenue_generated: totalRevenue,
          payment_amount_remaining: totalOutstanding,
          total_products_sold: totalProductsSold,
          reward_points: rewardPoints,
        };
      })
      .filter(reseller => {
        // keep only those with some sales or clearance in range
        return reseller.total_revenue_generated > 0 || reseller.payment_amount_remaining > 0;
      });
  }

  // --- NEW: Add Sorting Logic ---
  if (sortKey) {
    currentFiltered.sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      return 0;
    });
  }

  return currentFiltered;
}, [
  resellers,
  searchTerm,
  mainTableTimeRange,
  mainTableStartDate,
  mainTableEndDate,
  sortKey, // Add sort keys to dependencies
  sortDirection,
]);

// --- NEW: Export Functionality ---
const handleExport = () => {
  const data = filteredResellers.map(reseller => ({
    "ID": reseller.id,
    "Name": reseller.name,
    "Email": reseller.email,
    "Region": reseller.region,
    "Sub-Region": reseller.sub_region,
    "Total Revenue": reseller.total_revenue_generated,
    "Outstanding Amount": reseller.payment_amount_remaining,
    "Reward Points": reseller.reward_points,
    "Is Active": reseller.is_active ? 'Yes' : 'No',
    "Created At": new Date(reseller.created_at).toLocaleDateString(),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Resellers");

  XLSX.writeFile(wb, "resellers.xlsx");
  toast({
    title: "Export Successful",
    description: "Reseller data has been exported to resellers.xlsx",
  });
};

// --- NEW: Import Functionality ---
const handleAddResellerFromImport = async (reseller: any) => {
    const { name, email, phone, region,sub_region, coverage } = reseller;
    if (!name) return; // Skip rows without a name

    try {
      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult.data.session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(import.meta.env.VITE_ADD_RESELLER_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: name,
          email: email,
          phone: phone,
          region: region,
          sub_region: sub_region,
          coverage: coverage || 0,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Failed to add reseller ${name}.`);
      }
    } catch (error) {
      console.error(`Error adding reseller ${name}:`, error);
      // Log the error but continue with other rows
    }
  };

const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  setLoading(true);

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const headers = json[0] as string[];
    const resellerData = json.slice(1);

    for (const row of resellerData) {
      const reseller: any = {};
      headers.forEach((header, index) => {
        const key = header.toLowerCase().replace(/\s/g, '_');
        reseller[key] = (row as any)[index];
      });
      console.log(reseller)
      await handleAddResellerFromImport(reseller);
    }

    toast({
      title: "Import Successful",
      description: "Reseller data has been imported.",
    });
  } catch (error) {
    console.error('Error importing resellers:', error);
    toast({
      title: "Import Failed",
      description: "An error occurred during import.",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
    fetchResellers();
    if (event.target) {
        event.target.value = ''; // Clear the input field for next import
    }
  }
};


const getMonthOptions = () => {
    // Adding a 'Full Year' option at the start
    const options = [{ value: 'all', label: 'Full Year' }];
    for (let i = 0; i < 12; i++) {
        options.push({
            value: (i + 1).toString(),
            label: new Date(0, i).toLocaleString('en-US', { month: 'long' })
        });
    }
    return options;
};

  const getYearOptions = () => {
    const years = [];
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 5; i <= currentYear + 1; i++) { // 5 years back, current year, 1 year ahead
      years.push({ value: i.toString(), label: i.toString() });
    }
    return years;
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

    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6 ">
      <div className="healthcare-card fade-in-up flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          <div>
              <h1 className="text-3xl font-bold text-foreground">Reseller  Management</h1>
              <p className="text-muted-foreground mt-1">
                Manage your Reseller Network, track performance, and optimize your reseller relationships.
              </p>
          </div>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="w-full md:w-auto">+ Add Reseller</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Reseller</DialogTitle>
            </DialogHeader>
            <AddResellerForm onClose={() => setDetailsOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-6">
        
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Resellers</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex-grow">
            <div className="text-3xl font-bold">{resellers.length + resellers.filter(r => r.is_active).reduce((sum, r) => sum + (r.coverage || 0), 0)}</div>
          </CardContent>
        </Card>
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Resellers</CardTitle>
            <UserCheck className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex-grow">
            <div className="text-3xl font-bold">{resellers.filter(r => r.is_active).length}</div>
          </CardContent>
        </Card>
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Passive Resellers</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex-grow">
            <div className="text-3xl font-bold">
              {resellers.filter(r => r.is_active).reduce((sum, r) => sum + (r.coverage || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding </CardTitle>
            <HandCoins className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex-grow">
            <div className="text-3xl font-bold">
              ₹{resellers.reduce((sum, r) => sum + r.payment_amount_remaining, 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Resellers Table */}
      <Card>
        <CardHeader className="pb-3"> {/* Reduced padding-bottom */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-grow max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, region, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-full"
              />
            </div>
             {/* NEW: Import/Export Buttons */}

<TooltipProvider>
  <div className="flex items-center gap-2">
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Add size="sm" to match the other button */}
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Upload className="h-4 w-4" /> {/* Keep dimensions consistent */}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Export Reseller Data</TooltipContent>
    </Tooltip>

    <Tooltip>
      <TooltipTrigger asChild>
        <label
          htmlFor="import-file"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {/* Correct the height to match the other icon */}
          <Download className="h-4 w-4" />
        </label>
      </TooltipTrigger>
      <TooltipContent>Import Reseller Data</TooltipContent>
    </Tooltip>

<Input
 id="import-file"
type="file"
accept=".xlsx, .xls"
className="hidden"
onChange={handleImport}
 />
  </div>
</TooltipProvider>
            {/* Main Table Date Filter Buttons */}
            <div className="flex flex-wrap items-center gap-2 justify-start md:justify-end flex-grow">
              <Label className="text-sm text-muted-foreground min-w-[50px] md:min-w-0">Sales in:</Label>
              <Button
                variant={mainTableTimeRange === 'lifetime' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => { setMainTableTimeRange('lifetime'); setMainTableStartDate(''); setMainTableEndDate(''); }}
              >
                Lifetime
              </Button>
              <Button
                variant={mainTableTimeRange === '7d' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => { setMainTableTimeRange('7d'); setMainTableStartDate(''); setMainTableEndDate(''); }}
              >
                7D
              </Button>
              <Button
                variant={mainTableTimeRange === '30d' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => { setMainTableTimeRange('30d'); setMainTableStartDate(''); setMainTableEndDate(''); }}
              >
                30D
              </Button>
              <Button
                variant={mainTableTimeRange === '3m' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => { setMainTableTimeRange('3m'); setMainTableStartDate(''); setMainTableEndDate(''); }}
              >
                3M
              </Button>
              <Button
                variant={mainTableTimeRange === 'custom' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setMainTableTimeRange('custom')}
              >
                Custom
              </Button>
            </div>
          </div>
          {mainTableTimeRange === 'custom' && (
            <div className="flex flex-wrap items-center gap-4 p-3 border rounded-md bg-muted/50 mt-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="main-start-date" className="font-normal">From:</Label>
                <Input
                  id="main-start-date"
                  type="date"
                  value={mainTableStartDate}
                  onChange={(e) => setMainTableStartDate(e.target.value)}
                  className="h-9 w-[150px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="main-end-date" className="font-normal">To:</Label>
                <Input
                  id="main-end-date"
                  type="date"
                  value={mainTableEndDate}
                  onChange={(e) => setMainTableEndDate(e.target.value)}
                  className="h-9 w-[150px]"
                />
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
                      <TableHeader>
          <TableRow>
            <TableHead className="w-[40px] text-center">#</TableHead> {/* Numbering column */}
            <TableHead className="w-[80px]">Tier</TableHead>
            <TableHead className="min-w-[150px]">
              <div
                className="flex items-center gap-1 cursor-pointer select-none"
                onClick={() => handleSort('name')}
              >
                Name
                {sortKey === 'name' && (
                  <span>{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </div>
            </TableHead>
            <TableHead>Region</TableHead>
            <TableHead>Sub Region</TableHead>
            <TableHead>
              {/* NEW: Sortable Revenue Header */}
              <div
                className="flex items-center gap-1 cursor-pointer"
                onClick={() => handleSort('total_revenue_generated')}
              >
                Payables
                {sortKey === 'total_revenue_generated' && (
                  <span>{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </div>
            </TableHead>
            <TableHead>Outstanding</TableHead>
            <TableHead>Reward Points</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredResellers.length > 0 ? (
            filteredResellers.map((reseller, idx) => {
              const tierInfo = getTierInfo(reseller.reward_points || 0);
              return (
                <TableRow key={reseller.id}>
                  <TableCell className="text-center">{idx + 1}</TableCell> {/* Numbering cell */}
                  <TableCell>
                    <TierIcon svgName={tierInfo.svg} tier={tierInfo.tier} />
                  </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {reseller.name}
                            {reseller.is_active ? (
                              <span title="Login Enabled" className="text-green-500">
                                <CheckCircle2 className="h-4 w-4" />
                              </span>
                            ) : (
                              <span title="Login Disabled" className="text-gray-400">
                                <XCircle className="h-4 w-4" />
                              </span>
                            )}
                            {reseller.flagged_status && (
                              <Badge variant="destructive" className="ml-2">Flagged</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{reseller.region}</TableCell>
                        <TableCell>{reseller.sub_region}</TableCell>
                        <TableCell>₹{reseller.total_revenue_generated?.toFixed(2) ?? '0.00'}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              reseller.payment_amount_remaining === 0
                                ? "bg-green-100 text-green-800 hover:bg-green-100"
                                : "bg-red-100 text-red-800 hover:bg-red-100"
                            }
                          >
                            ₹{reseller.payment_amount_remaining.toFixed(2)}
                          </Badge>
                        </TableCell>
                        <TableCell>{reseller.reward_points || 0}</TableCell>
                        <TableCell className="text-right">
                          <Dialog open={detailsOpen && selectedReseller?.id === reseller.id} onOpenChange={(open) => {
                            setDetailsOpen(open);
                            if (!open) setSelectedReseller(null); // Clear selected reseller when closing
                          }}>
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

                            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
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
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
                                  {/* Left Column: Editable Information */}
                                  <div className="md:col-span-1 space-y-4 border rounded-lg p-4 h-fit">
                                    <h3 className="text-lg font-semibold mb-2">Basic Information (Editable)</h3>
                                    <div>
                                      <Label htmlFor="reseller-name">Name</Label>
                                      <Input
                                        id="reseller-name"
                                        value={editableResellerName}
                                        onChange={(e) => setEditableResellerName(e.target.value)}
                                        className="mt-1"
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="reseller-email">Email</Label>
                                      <Input
                                        id="reseller-email"
                                        type="email"
                                        value={editableEmail}
                                        onChange={(e) => setEditableEmail(e.target.value)}
                                        className="mt-1"
                                      />
                                    </div>
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
                                      <Label htmlFor="reseller-sub-region">Sub Region</Label>
                                      <Input
                                        id="reseller-sub-region"
                                        value={editableSubRegion}
                                        onChange={(e) => setEditableSubRegion(e.target.value)}
                                        className="mt-1"
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
                                    <Button onClick={handleUpdateResellerDetails} className="w-full">
                                      Save Basic Info
                                    </Button>
                                    <div className="mt-4 border-t pt-4">
                                      <h4 className="text-md font-semibold mb-2">Login Access</h4>
                                      <div className="flex items-center justify-between">
                                        <Label htmlFor="login-access">Enable Login Access</Label>
                                        <Button
                                          variant={isLoginAccessEnabled ? "default" : "outline"}
                                          size="sm"
                                          onClick={() => handleToggleLoginAccess(selectedReseller.id, isLoginAccessEnabled)}
                                        >
                                          {isLoginAccessEnabled ? "Disable" : "Enable"}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right Column: Financial & Performance (Chart first) */}
                                  <div className="md:col-span-2 space-y-6">
                                    {/* Sales Performance Graph */}
                                    <div className="space-y-4 border rounded-lg p-4">
                                      <h3 className="text-lg font-semibold mb-2">Sales Performance Graph</h3>
                                      <div className="flex flex-col gap-4 mb-4">
                                        <div className="flex items-center flex-wrap gap-2">
                                          <Button
                                            variant={timeRange === '7d' ? 'secondary' : 'outline'}
                                            size="sm"
                                            onClick={() => { setTimeRange('7d')}}
                                          >
                                            7D
                                          </Button>
                                          <Button
                                            variant={timeRange === '30d' ? 'secondary' : 'outline'}
                                            size="sm"
                                            onClick={() => { setTimeRange('30d') }}
                                          >
                                            30D
                                          </Button>
                                          <Button
                                            variant={timeRange === '3m' ? 'secondary' : 'outline'}
                                            size="sm"
                                            onClick={() => { setTimeRange('3m')}}
                                          >
                                            3M
                                          </Button>
                                          <Button
                                            variant={timeRange === 'lifetime' ? 'secondary' : 'outline'}
                                            size="sm"
                                            onClick={() => { setTimeRange('lifetime')}}
                                          >
                                            Lifetime
                                          </Button>
                                          <Button
                                            variant={timeRange === 'custom' ? 'secondary' : 'outline'}
                                            size="sm"
                                            onClick={() => setTimeRange('custom')}
                                          >
                                            Custom
                                          </Button>
                                        </div>
                                        {timeRange === 'custom' && (
                                          <div className="flex flex-wrap items-center gap-4 p-3 border rounded-md bg-muted/50">
                                            <div className="flex items-center gap-2">
                                              <Label htmlFor="chart-start-date" className="font-normal">From:</Label>
                                              <Input
                                                id="chart-start-date"
                                                type="date"
                                                value={customStartDate}
                                                onChange={(e) => setCustomStartDate(e.target.value)}
                                                onBlur={() => fetchResellerSalesData(selectedReseller.id)} // Fetch on blur
                                                className="h-9 w-[150px]"
                                              />
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <Label htmlFor="chart-end-date" className="font-normal">To:</Label>
                                              <Input
                                                id="chart-end-date"
                                                type="date"
                                                value={customEndDate}
                                                onChange={(e) => setCustomEndDate(e.target.value)}
                                                onBlur={() => fetchResellerSalesData(selectedReseller.id)} // Fetch on blur
                                                className="h-9 w-[150px]"
                                              />
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {chartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={200}>
                                          <LineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis fontSize={12} tickFormatter={(v) => `₹${v}`} />
                                            <Tooltip />
                                            <Legend />
                                            <Line type="monotone" dataKey="revenue" stroke="#8884d8" activeDot={{ r: 6 }} />
                                          </LineChart>
                                        </ResponsiveContainer>
                                      ) : (
                                        <div className="h-32 flex items-center justify-center text-muted-foreground">
                                          No sales data for the selected period.
                                        </div>
                                      )}
                                    </div>

                                    {/* Non-Editable Information & Financial Summary */}
                                    <div className="space-y-4 border rounded-lg p-4">
                                      <h3 className="text-lg font-semibold mb-2">Financial Summary & Other Details</h3>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 truncate">
                                        <InfoItem label="Reseller ID" value={`${selectedReseller.name?.replace(/\s/g, '') || ''}-${selectedReseller.region?.replace(/\s/g, '') || ''}-${selectedReseller.id.slice(0, 4)}`} />
                                        <InfoItem label="Username" value="Set by reseller on first login" />
                                        <div className='truncate'>
                                        <InfoItem label="Email" value={selectedReseller.email || "Initially empty; set by reseller on first login"} />

                                        </div>
                                        <InfoItem label="Phone Number" value={selectedReseller.contact_info?.phone || "Initially empty; compulsory on first login"} />
                                        <InfoItem label="Total Products Sold" value={selectedReseller.total_products_sold} />
                                        <InfoItem label="Total Revenue Generated (Lifetime)" value={`₹${selectedReseller.total_revenue_generated?.toFixed(2) ?? '0.00'}`} />
                                        <InfoItem label="Total Outstanding Amount (Lifetime)" value={`₹${selectedReseller.payment_amount_remaining.toFixed(2) ?? '0.00'}`} />
                                        <InfoItem label="Current Reward Points" value={selectedReseller.reward_points || 0} />
                                        <InfoItem label="Active Resellers (Sub-hierarchy)" value={selectedReseller.sub_active_resellers || 0} />
                                        <InfoItem label="Passive Resellers (Sub-hierarchy)" value={selectedReseller.sub_passive_resellers || 0} />
                                      </div>
                                    </div>


                                  </div>
                                    {/* Recent Sales Table (with Month/Year Filter) */}
                                    <div className="space-y-4 border rounded-lg col-span-3 p-4">
                                        <h3 className="text-lg font-semibold mb-2">Recent Sales</h3>
                                        <div className="flex flex-wrap items-center gap-4 mb-4">
                                            <Label htmlFor="sales-month" className="min-w-[40px]">Month:</Label>
                                            <Select value={salesTableMonth} onValueChange={setSalesTableMonth}>
                                                <SelectTrigger id="sales-month" className="w-[150px]">
                                                    <SelectValue placeholder="Select Month" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">Full Year</SelectItem> {/* Explicitly add 'Full Year' item */}
                                                    {getMonthOptions().map(option => {
                                                        // Skip the 'Full Year' option as it's already added.
                                                        if (option.value === 'all') return null;
                                                        return (
                                                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                                        );
                                                    })}
                                                </SelectContent>
                                            </Select>

                                            <Label htmlFor="sales-year" className="min-w-[30px]">Year:</Label>
                                            <Select value={salesTableYear} onValueChange={setSalesTableYear}>
                                                <SelectTrigger id="sales-year" className="w-[100px]">
                                                    <SelectValue placeholder="Select Year" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {getYearOptions().map(option => (
                                                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Card>
                                            <CardContent className="p-0">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Date</TableHead>
                                                            <TableHead className="text-right">Payables</TableHead>
                                                            <TableHead className="text-right">Paid</TableHead>
                                                            <TableHead className="text-right">Outstanding</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {filteredResellerSalesForTable.length > 0 ? (
                                                            filteredResellerSalesForTable.map((sale) => {
                                                                const total = typeof sale.total === 'number' ? sale.total : 0;
                                                                const paid = typeof sale.paid === 'number' ? sale.paid : 0;
                                                                const outstanding = typeof sale.outstanding === 'number' ? sale.outstanding : 0;
                                                                return (
                                                                    <TableRow key={sale.id}>
                                                                        <TableCell><p>{new Date(sale.date).toLocaleDateString()}</p></TableCell>
                                                                        <TableCell className="text-right">₹{total.toFixed(2)}</TableCell>
                                                                        <TableCell className="text-right">₹{paid.toFixed(2)}</TableCell>
                                                                        <TableCell className="text-right font-medium">₹{outstanding.toFixed(2)}</TableCell>
                                                                    </TableRow>
                                                                );
                                                            })
                                                        ) : (
                                                            <TableRow>
                                                                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                                                    No sales found for the selected month/year.
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No resellers found matching your criteria.
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