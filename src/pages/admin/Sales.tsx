import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { addDays, format, subMonths, subYears } from "date-fns";
import { DateRange } from "react-day-picker";
import * as XLSX from "xlsx";
import Select from "react-select";
import EnhancedSalesDashboard from "./EnhancedSalesDashboard";
import ExcelImport from "./ExcelImport";
import {
  Search,
  Upload,
  Trash2,
  Plus,
  Undo,
  Redo,
  Calendar as CalendarIcon,
  Copy,
  Badge,
  TrendingUp,
} from "lucide-react";
// import {
//   Dialog,
//   DialogContent,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
//   DialogTrigger,
//   DialogClose,
// } from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select as UISelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// --- INTERFACE DEFINITIONS ---

interface Product {
  id: string;
  name: string;
  mrp: number | null;
  sku_id?: string;
  price_ranges: { min: number; max: number; price: number }[] | null;
  inventory: number | null;
}

interface User {
  id: string;
  name: string | null;
  email?: string | null;
  role?: string;
  due_balance?: number; // Add due_balance to track outstanding amounts
}

type TransactionType = "Sale" | "Clearance";
type PaymentStatus =
  | "Fully Paid"
  | "Partially Paid"
  | "Pending"
  | "Partial Clearance"
  | "Complete Clearance"
  | "Due Cleared";

interface Sale {
  id: string;
  date: string;
  qty: number;
  price: number;
  total: number;
  paid: number;
  outstanding: number;
  payment_status: PaymentStatus;
  member_id: string;
  product_id: string | null;
  transaction_type: TransactionType; // New field to distinguish record types
  users: User | null;
  products: Product | null;
}

interface UndoOperation {
  type: "delete" | "add" | "edit" | "import" | "duplicate";
  timestamp: number;
  data: {
    deletedRecords?: Sale[];
    addedRecord?: Sale;
    importedRecords?: Sale[];
    duplicatedRecords?: Sale[];
    recordId?: string;
    field?: keyof Sale;
    oldValue?: any;
    record?: Sale;
    originalRecord?: Sale;
    updatedRecord?: Sale;
    userBalanceChanges?: {
      userId: string;
      oldBalance: number;
      newBalance: number;
    }[];
    updatedSalesRecords?: any[];
    salesRecordReversals?: any[];
    inventoryChanges?: {
      productId: string;
      oldInventory: number;
      newInventory: number;
    }[];
  };
}

// --- HELPER FUNCTIONS ---

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);

const statusColors: { [key: string]: string } = {
  "Fully Paid": "text-green-600 dark:text-green-400",
  "Partially Paid": "text-yellow-600 dark:text-yellow-400",
  Pending: "text-red-600 dark:text-red-400",
  "Partial Clearance": "text-blue-600 dark:text-blue-400",
  "Complete Clearance": "text-green-600 dark:text-green-400",
  "Due Cleared": "text-gray-600 dark:text-gray-400",
};

const transactionTypeColors: { [key: string]: string } = {
  Sale: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  Clearance:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
};

const getSelectStyles = (isDark: boolean) => ({
  control: (provided: any) => ({
    ...provided,
    backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
    borderColor: isDark ? "#4B5563" : "#D1D5DB",
  }),
  menu: (provided: any) => ({
    ...provided,
    backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: state.isSelected
      ? "#3B82F6"
      : state.isFocused
      ? isDark
        ? "#374151"
        : "#F3F4F6"
      : "transparent",
    color: state.isSelected ? "#FFFFFF" : isDark ? "#F9FAFB" : "#111827",
  }),
  singleValue: (provided: any) => ({
    ...provided,
    color: isDark ? "#F9FAFB" : "#111827",
  }),
  input: (provided: any) => ({
    ...provided,
    color: isDark ? "#F9FAFB" : "#111827",
  }),
});

// --- TRANSACTION TYPE OPTIONS ---
const transactionTypeOptions = [
  { label: "Sale", value: "Sale" },
  { label: "Clearance", value: "Clearance" },
];

// --- MAIN COMPONENT ---

const SalesTable: React.FC = () => {
  const { toast } = useToast();
  
  // --- STATE MANAGEMENT ---
  const [sales, setSales] = useState<Sale[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [userOptions, setUserOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const [productOptions, setProductOptions] = useState<
    { label: string; value: string }[]
  >([]);

  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    field: keyof Sale;
  } | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newSale, setNewSale] = useState<Partial<Sale>>({
    date: new Date().toISOString().slice(0, 10),
  });

  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(2000, 0, 1),
    to: addDays(new Date(), 0),
  });

  // Month/Year filter states
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [isMonthYearFilter, setIsMonthYearFilter] = useState(true); // Default to monthly view

  const [customDate, setCustomDate] = useState<DateRange | undefined>(date);
  const [isPopoverOpen, setPopoverOpen] = useState(false);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showMoreProducts, setShowMoreProducts] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<UndoOperation[]>([]);
  const [redoStack, setRedoStack] = useState<UndoOperation[]>([]);
  const [isUndoing, setIsUndoing] = useState(false);

  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: "ascending" | "descending";
  }>({
    key: "date",
    direction: "descending",
  });

  // For add-new calendar popover
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [membersWithDues, setMembersWithDues] = useState<
    {
      userId: string;
      userName: string;
      totalDue: number;
      pendingSales: {
        productName: string;
        outstanding: number;
        date: string;
      }[];
    }[]
  >([]);

  const fetchMembersWithDues = async () => {
    try {
      const { data: salesWithDues, error } = await supabase
        .from("sales")
        .select(
          `
        id,
        member_id,
        outstanding,
        date,
        payment_status,
        transaction_type,
        users!inner(id, name),
        products(name)
      `
        )
        .eq("transaction_type", "Sale")
        .in("payment_status", ["Pending", "Partially Paid"])
        .gt("outstanding", 0);

      if (error) {
        console.error("Error fetching members with dues:", error);
        return;
      }
      const memberDuesMap = new Map();

      salesWithDues?.forEach((sale) => {
        const memberId = sale.member_id;
        const memberName = sale.users?.name || "Unknown";

        if (!memberDuesMap.has(memberId)) {
          memberDuesMap.set(memberId, {
            userId: memberId,
            userName: memberName,
            totalDue: 0,
            pendingSales: [],
          });
        }

        const memberData = memberDuesMap.get(memberId);
        memberData.totalDue += sale.outstanding;
        memberData.pendingSales.push({
          productName: sale.products?.name || "Unknown Product",
          outstanding: sale.outstanding,
          date: sale.date,
        });
      });

      setMembersWithDues(Array.from(memberDuesMap.values()));
    } catch (error) {
      console.error("Error fetching members with dues:", error);
    }
  };

  useEffect(() => {
    fetchMembersWithDues();
  }, [sales]);

  const getClearanceUserOptions = useMemo(() => {
    if (newSale.transaction_type !== "Clearance") {
      return userOptions; // Return all users for non-clearance transactions
    }

    // For clearance transactions, only show members with outstanding dues (without due amounts)
    return membersWithDues.map((member) => ({
      label: member.userName, // Removed the due amount display
      value: member.userId,
    }));
  }, [newSale.transaction_type, userOptions, membersWithDues]);

  const getPendingSalesForMember = (memberId: string) => {
    const memberData = membersWithDues.find((m) => m.userId === memberId);
    return memberData?.pendingSales || [];
  };

  // --- DATA FETCHING ---

  const fetchSales = async () => {
    let startDate: string;
    let endDate: string;

    if (isMonthYearFilter) {
      // Use month/year filter
      const start = new Date(selectedYear, selectedMonth - 1, 1);
      const end = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
      startDate = start.toISOString();
      endDate = end.toISOString();
    } else {
      // Use date range filter
      if (!date?.from || !date?.to) {
        return;
      }
      startDate = date.from.toISOString();
      endDate = date.to.toISOString();
    }

    const { data, error } = await supabase
      .from("sales")
      .select("*, users(*), products(*)")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });

    if (error) {
      console.error("Error fetching sales:", error);
      toast({
        title: "Error",
        description: `Error fetching sales: ${error.message}`,
        variant: "destructive",
      });
    } else {
      setSales(
        Array.isArray(data)
          ? data
              .filter(
                (row: any) =>
                  row &&
                  typeof row === "object" &&
                  row.payment_status !== undefined
              )
              .map((row: any) => ({
                id: row.id,
                date: row.date,
                qty: row.qty || 0,
                price: row.price || 0,
                total: row.total,
                paid: row.paid,
                outstanding: row.outstanding,
                payment_status: row.payment_status ?? "Pending",
                member_id: row.member_id,
                product_id: row.product_id || "",
                transaction_type: row.transaction_type || "Sale", // Default to Sale for existing records
                users:
                  row.users && typeof row.users === "object" ? row.users : null,
                products:
                  row.products && typeof row.products === "object"
                    ? row.products
                    : null,
              }))
          : []
      );
    }
  };

  const fetchDropdownData = async () => {
    try {
      const usersPromise = supabase
        .from("users")
        .select("id, name, due_balance");
      const productsPromise = supabase
        .from("products")
        .select("id, name, mrp, price_ranges, inventory");

      const [usersResult, productsResult] = await Promise.all([
        usersPromise,
        productsPromise,
      ]);

      if (usersResult.error) throw usersResult.error;
      if (productsResult.error) throw productsResult.error;

      setUsers(usersResult.data || []);
      const userOpts = (usersResult.data || [])
        .filter((u) => u.name)
        .map((u) => ({
          label: u.name!,
          value: u.id,
        }));
      setUserOptions(userOpts);

      setProducts(
        (productsResult.data || []).map((p) => ({
          ...p,
          price_ranges:
            typeof p.price_ranges === "string"
              ? JSON.parse(p.price_ranges)
              : p.price_ranges,
        }))
      );
      const productOpts = (productsResult.data || []).map((p) => ({
        label: p.name,
        value: p.id,
      }));
      setProductOptions(productOpts);
    } catch (error: any) {
      console.error("Error fetching dropdown data:", error.message);
    }
  };

  // --- NEW HELPER FUNCTIONS FOR TRANSACTION LOGIC ---

  const updateProductInventory = async (
    productId: string,
    qtyChange: number
  ): Promise<number> => {
    const { data: currentProduct, error: fetchError } = await supabase
      .from("products")
      .select("inventory")
      .eq("id", productId)
      .single();

    if (fetchError) throw fetchError;

    const oldInventory = currentProduct.inventory || 0;
    const newInventory = oldInventory + qtyChange;

    const { error: updateError } = await supabase
      .from("products")
      .update({ inventory: newInventory })
      .eq("id", productId);

    if (updateError) throw updateError;

    return oldInventory;
  };

  const updateUserBalance = async (
    userId: string,
    amountChange: number
  ): Promise<number> => {
    const { data: currentUser, error: fetchError } = await supabase
      .from("users")
      .select("due_balance")
      .eq("id", userId)
      .single();

    if (fetchError) throw fetchError;

    const oldBalance = currentUser.due_balance || 0;
    const newBalance = oldBalance + amountChange;

    const { error: updateError } = await supabase
      .from("users")
      .update({ due_balance: newBalance })
      .eq("id", userId);

    if (updateError) throw updateError;

    return oldBalance;
  };

  const updatePendingSalesStatus = async (userId: string) => {
    // Check if user's balance is now zero
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("due_balance")
      .eq("id", userId)
      .single();

    if (userError || !user || user.due_balance !== 0) return;

    // Update all pending/partially paid sales to "Due Cleared"
    const { error: updateError } = await supabase
      .from("sales")
      .update({ payment_status: "Due Cleared" })
      .eq("member_id", userId)
      .in("payment_status", ["Pending", "Partially Paid"]);

    if (updateError) {
      console.error("Error updating pending sales status:", updateError);
    }
  };

  const calculatePaymentStatus = (
    transactionType: TransactionType,
    total: number,
    paid: number,
    userBalance: number
  ): PaymentStatus => {
    if (transactionType === "Sale") {
      if (paid >= total) return "Fully Paid";
      if (paid > 0) return "Partially Paid";
      return "Pending";
    } else {
      // Clearance
      const newBalance = userBalance - paid;
      if (newBalance <= 0) return "Complete Clearance";
      return "Partial Clearance";
    }
  };


  // Real-time refresh for sales, expenses, inventory, and products
  useEffect(() => {
    fetchSales();

    const handleRelevantChange = () => {
      fetchSales();
    };

    // Subscribe to sales changes
    const salesChannel = supabase
      .channel('sales-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, handleRelevantChange)
      .subscribe();

    // Subscribe to expenses changes
    const expensesChannel = supabase
      .channel('expenses-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, handleRelevantChange)
      .subscribe();

    // Subscribe to inventory changes
    const inventoryChannel = supabase
      .channel('inventory-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, handleRelevantChange)
      .subscribe();

    // Subscribe to products changes
    const productsChannel = supabase
      .channel('products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, handleRelevantChange)
      .subscribe();

    return () => {
      supabase.removeChannel(salesChannel);
      supabase.removeChannel(expensesChannel);
      supabase.removeChannel(inventoryChannel);
      supabase.removeChannel(productsChannel);
    };
  }, [date, isMonthYearFilter, selectedYear, selectedMonth]);

  // Command palette event listeners
  useEffect(() => {
    const handleAddSaleModal = () => {
      setAddingNew(true);
    };

    const handleImportSale = () => {
      const importBtn = document.querySelector('[data-command-import-btn]') as HTMLElement;
      if (importBtn) {
        importBtn.click();
      }
    };

    const handleExportSale = () => {
      handleExportToExcel();
    };

    window.addEventListener('open-add-sale-modal', handleAddSaleModal);
    window.addEventListener('open-import-sale', handleImportSale);
    window.addEventListener('open-export-sale', handleExportSale);

    return () => {
      window.removeEventListener('open-add-sale-modal', handleAddSaleModal);
      window.removeEventListener('open-import-sale', handleImportSale);
      window.removeEventListener('open-export-sale', handleExportSale);
    };
  }, []);

  useEffect(() => {
    fetchDropdownData();
  }, []);

  useEffect(() => {
    const checkDarkMode = () =>
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // --- ENHANCED CRUD & FEATURE FUNCTIONS ---
  const addToUndoStack = (operation: UndoOperation) => {
    if (isUndoing) return;
    setUndoStack((prev) => [...prev, operation].slice(-10));
    setRedoStack([]);
  };

  const updateSalesRecordsForClearance = async (
    userId: string,
    clearanceAmount: number
  ) => {
    // Get all pending/partially paid sales for this user, ordered by date (oldest first)
    const { data: pendingSales, error } = await supabase
      .from("sales")
      .select("*")
      .eq("member_id", userId)
      .eq("transaction_type", "Sale")
      .in("payment_status", ["Pending", "Partially Paid"])
      .gt("outstanding", 0)
      .order("date", { ascending: true });

    if (error) throw error;
    if (!pendingSales || pendingSales.length === 0) return [];

    let remainingClearanceAmount = clearanceAmount;
    const updatedRecords: any[] = [];

    for (const sale of pendingSales) {
      if (remainingClearanceAmount <= 0) break;

      const outstandingAmount = sale.outstanding;
      const paymentToApply = Math.min(
        remainingClearanceAmount,
        outstandingAmount
      );

      const newPaid = sale.paid + paymentToApply;
      const newOutstanding = sale.total - newPaid;

      let newStatus: PaymentStatus;
      if (newOutstanding <= 0) {
        newStatus = "Due Cleared";
      } else if (newPaid > 0) {
        newStatus = "Partially Paid";
      } else {
        newStatus = "Pending";
      }

      // Update the sales record
      const { error: updateError } = await supabase
        .from("sales")
        .update({
          paid: newPaid,
          outstanding: newOutstanding,
          payment_status: newStatus,
        })
        .eq("id", sale.id);

      if (updateError) throw updateError;

      updatedRecords.push({
        id: sale.id,
        oldPaid: sale.paid,
        newPaid: newPaid,
        oldOutstanding: sale.outstanding,
        newOutstanding: newOutstanding,
        oldStatus: sale.payment_status,
        newStatus: newStatus,
        paymentApplied: paymentToApply,
      });

      remainingClearanceAmount -= paymentToApply;
    }

    return updatedRecords;
  };

  const revertSalesRecordsForClearance = async (updatedRecords: any[]) => {
    for (const record of updatedRecords) {
      await supabase
        .from("sales")
        .update({
          paid: record.oldPaid,
          outstanding: record.oldOutstanding,
          payment_status: record.oldStatus,
        })
        .eq("id", record.id);
    }
  };

  const handleAddNew = async () => {
    const transactionType = newSale.transaction_type || "Sale";

    // Enhanced validation for clearance transactions
    if (transactionType === "Clearance") {
      const requiredFields: (keyof Sale)[] = ["date", "member_id", "paid"];
      if (!requiredFields.every((field) => newSale[field] != null)) {
        toast({
          title: "Missing Fields",
          description: "Please fill all required fields for Clearance: Date, Member, Paid Amount",
          variant: "destructive",
        });
        return;
      }

      // Check if member has outstanding dues
      const memberWithDues = membersWithDues.find(
        (m) => m.userId === newSale.member_id
      );
      if (!memberWithDues || memberWithDues.totalDue <= 0) {
        toast({
          title: "No Outstanding Dues",
          description: "Selected member has no outstanding dues to clear.",
          variant: "destructive",
        });
        return;
      }

      const paidAmount = Number(newSale.paid);
      if (paidAmount > memberWithDues.totalDue) {
        toast({
          title: "Payment Exceeds Due",
          description: `Payment amount (₹${paidAmount}) cannot exceed member's total due balance (₹${memberWithDues.totalDue})`,
          variant: "destructive",
        });
        return;
      }

      if (paidAmount <= 0) {
        toast({
          title: "Invalid Amount",
          description: "Payment amount must be greater than zero.",
          variant: "destructive",
        });
        return;
      }
    } else {
      // Original validation for sales
      const requiredFields: (keyof Sale)[] = [
        "date",
        "member_id",
        "product_id",
        "qty",
        "price",
      ];
      if (!requiredFields.every((field) => newSale[field] != null)) {
        toast({
          title: "Missing Fields",
          description: "Please fill all required fields for Sale: Date, Member, Product, Qty, Price",
          variant: "destructive",
        });
        return;
      }
    }

    const user = users.find((u) => u.id === newSale.member_id);
    if (!user) {
      toast({
        title: "User Not Found",
        description: "Selected user not found",
        variant: "destructive",
      });
      return;
    }

    // Create optimistic record
    let optimisticRecord: Sale;
    const tempId = `temp-${Date.now()}`;

    if (transactionType === "Sale") {
      const qty = Number(newSale.qty);
      const price = Number(newSale.price);
      const total = qty * price;
      const paid = Number(newSale.paid ?? 0);
      const outstanding = total - paid;
      const payment_status = calculatePaymentStatus("Sale", total, paid, 0);

      optimisticRecord = {
        id: tempId,
        date: String(newSale.date),
        qty,
        price,
        total,
        paid,
        outstanding,
        payment_status,
        member_id: String(newSale.member_id),
        product_id: String(newSale.product_id),
        transaction_type: "Sale",
        users: user,
        products: products.find(p => p.id === newSale.product_id) || null,
      };
    } else {
      const paid = Number(newSale.paid);
      const currentUserBalance = user.due_balance || 0;
      const payment_status = calculatePaymentStatus("Clearance", 0, paid, currentUserBalance);

      optimisticRecord = {
        id: tempId,
        date: String(newSale.date),
        qty: 0,
        price: 0,
        total: 0,
        paid,
        outstanding: 0,
        payment_status,
        member_id: String(newSale.member_id),
        product_id: null,
        transaction_type: "Clearance",
        users: user,
        products: null,
      };
    }

    // Optimistically add to UI
    setSales([optimisticRecord, ...sales]);
    setNewSale({});
    setAddingNew(false);

    try {
      let recordToInsert: any;
      let userBalanceChange = 0;
      let oldUserBalance = 0;
      let updatedSalesRecords: any[] = [];
      let inventoryChanges: {
        productId: string;
        oldInventory: number;
        newInventory: number;
      }[] = [];

      if (transactionType === "Sale") {
        const qty = Number(newSale.qty);
        const price = Number(newSale.price);
        const total = qty * price;
        const paid = Number(newSale.paid ?? 0);
        const outstanding = total - paid;

        userBalanceChange = outstanding; // Increase user's due balance by outstanding amount
        oldUserBalance = await updateUserBalance(
          newSale.member_id!,
          userBalanceChange
        );

        const payment_status = calculatePaymentStatus(
          transactionType,
          total,
          paid,
          0
        );

        recordToInsert = {
          date: String(newSale.date),
          member_id: String(newSale.member_id),
          product_id: String(newSale.product_id),
          qty,
          price,
          total,
          paid,
          outstanding,
          payment_status,
          transaction_type: transactionType,
        };

        // Update product inventory - subtract qty from stock for sales (allow negative inventory)
        if (newSale.product_id && qty !== 0) {
          // Get current inventory
          const { data: product, error: prodErr } = await supabase
            .from("products")
            .select("inventory")
            .eq("id", newSale.product_id)
            .single();
          if (!prodErr && product) {
            const oldInventory = product.inventory || 0;
            const newInventory = oldInventory - qty;
            await supabase.from("products").update({ inventory: newInventory }).eq("id", newSale.product_id);
            inventoryChanges.push({ productId: newSale.product_id, oldInventory, newInventory });
          }
        }
      } else {
        // Clearance
        const paid = Number(newSale.paid);
        const currentUserBalance = user.due_balance || 0;

        // Double-check against current database balance (in case of concurrent updates)
        if (paid > currentUserBalance) {
          toast({
            title: "Payment Exceeds Balance",
            description: `Payment amount (₹${paid}) cannot exceed user's current due balance (₹${currentUserBalance}). Please refresh and try again.`,
            variant: "destructive",
          });
          // Revert optimistic update
          setSales(prev => prev.filter(s => s.id !== tempId));
          setAddingNew(true);
          setNewSale(optimisticRecord);
          return;
        }

        // Update sales records first to apply the clearance payment
        updatedSalesRecords = await updateSalesRecordsForClearance(
          newSale.member_id!,
          paid
        );

        userBalanceChange = -paid; // Decrease user's due balance
        oldUserBalance = await updateUserBalance(
          newSale.member_id!,
          userBalanceChange
        );

        const payment_status = calculatePaymentStatus(
          transactionType,
          0,
          paid,
          currentUserBalance
        );

        recordToInsert = {
          date: String(newSale.date),
          member_id: String(newSale.member_id),
          product_id: null, // Clearance records don't have products
          qty: 0,
          price: 0,
          total: 0,
          paid,
          outstanding: 0,
          payment_status,
          transaction_type: transactionType,
        };
      }

      const { data, error } = await supabase
        .from("sales")
        .insert([recordToInsert])
        .select("*, users(*), products(*)");

      if (error) {
        // Revert changes if insert fails
        await updateUserBalance(newSale.member_id!, -userBalanceChange);
        if (updatedSalesRecords.length > 0) {
          await revertSalesRecordsForClearance(updatedSalesRecords);
        }
        // Revert inventory changes
        for (const change of inventoryChanges) {
          await updateProductInventory(
            change.productId,
            change.oldInventory - change.newInventory
          );
        }
        // Revert optimistic update
        setSales(prev => prev.filter(s => s.id !== tempId));
        toast({
          title: "Insert Failed",
          description: "Insert failed: " + error.message,
          variant: "destructive",
        });
      } else if (data) {
        const rawRecord = data[0];
        const addedRecord: Sale = {
          id: rawRecord.id,
          date: String(rawRecord.date),
          qty: rawRecord.qty || 0,
          price: rawRecord.price || 0,
          total: rawRecord.total,
          paid: rawRecord.paid,
          outstanding: rawRecord.outstanding,
          payment_status: rawRecord.payment_status as PaymentStatus,
          member_id: rawRecord.member_id,
          product_id: rawRecord.product_id || null,
          transaction_type: rawRecord.transaction_type as TransactionType,
          users:
            rawRecord.users && typeof rawRecord.users === "object"
              ? {
                  id: rawRecord.users.id,
                  name: rawRecord.users.name,
                  email: rawRecord.users.email,
                  role: rawRecord.users.role,
                  due_balance: rawRecord.users.due_balance,
                }
              : null,
          products:
            rawRecord.products && typeof rawRecord.products === "object"
              ? {
                  id: rawRecord.products.id,
                  name: rawRecord.products.name,
                  mrp: rawRecord.products.mrp,
                  sku_id: rawRecord.products.sku_id || undefined,
                  price_ranges: typeof rawRecord.products.price_ranges === "string"
                    ? JSON.parse(rawRecord.products.price_ranges)
                    : rawRecord.products.price_ranges,
                  inventory: rawRecord.products.inventory ?? null,
                }
              : null,
        };

        // Replace optimistic record with real record
        setSales(prev => prev.map(s => s.id === tempId ? addedRecord : s));

        addToUndoStack({
          type: "add",
          timestamp: Date.now(),
          data: {
            addedRecord,
            userBalanceChanges: [
              {
                userId: newSale.member_id!,
                oldBalance: oldUserBalance,
                newBalance: oldUserBalance + userBalanceChange,
              },
            ],
            updatedSalesRecords: updatedSalesRecords,
            inventoryChanges: inventoryChanges,
          },
        });

        // Refresh all data to show updated records
        fetchDropdownData();
        fetchMembersWithDues();

        if (transactionType === "Clearance" && updatedSalesRecords.length > 0) {
          toast({
            title: "Clearance Applied",
            description: `Clearance applied successfully! Updated ${
              updatedSalesRecords.length
            } sales record(s). Total amount cleared: ₹${Number(
              newSale.paid
            ).toFixed(2)}`,
          });
        } else if (transactionType === "Sale") {
          toast({
            title: "Success",
            description: "Sale record added successfully!",
          });
        }
      }
    } catch (error: any) {
      // Revert optimistic update
      setSales(prev => prev.filter(s => s.id !== tempId));
      toast({
        title: "Transaction Failed",
        description: "Transaction failed: " + error.message,
        variant: "destructive",
      });
      console.error("Transaction error:", error);
    }
  };

  const handleEditChange = async (
    id: string,
    field: keyof Sale,
    value: any
  ) => {
    const originalSale = sales.find((sale) => sale.id === id);
    if (!originalSale) return;

    // Prevent editing of Clearance records except for date and member
    if (
      originalSale.transaction_type === "Clearance" &&
      !["date", "member_id", "paid"].includes(field)
    ) {
      toast({
        title: "Edit Restricted",
        description: "Clearance records can only have date, member, or paid amount edited. To make other changes, delete this record and create a new one.",
        variant: "destructive",
      });
      return;
    }

    let updatePayload: { [key: string]: any } = { [field]: value };
    let updatedRecordForUI = { ...originalSale, [field]: value };
    let userBalanceChange = 0;
    let oldUserBalance = 0;
    let inventoryChanges: {
      productId: string;
      oldInventory: number;
      newInventory: number;
    }[] = [];

    // Optimistically update UI
    setSales(prev => prev.map(s => s.id === id ? updatedRecordForUI : s));
    setEditingCell(null);

    try {
      if (originalSale.transaction_type === "Sale") {
        // Handle Sale record edits
        if (field === "qty") {
          const product = originalSale.products;
          const newQty = Number(value);
          const oldQty = originalSale.qty;

          if (
            product &&
            Array.isArray(product.price_ranges) &&
            product.price_ranges.length > 0
          ) {
            // Only update price if imported price is missing or invalid
            let importedPrice = updatedRecordForUI.price;
            // Remove currency symbol and commas if present
            if (typeof importedPrice === 'string') {
              importedPrice = importedPrice.replace(/[^\d.]/g, '');
            }
            importedPrice = Number(importedPrice);
            if (importedPrice === null || importedPrice === undefined || isNaN(importedPrice) || importedPrice <= 0) {
              const priceRange = product.price_ranges.find(
                (range) => newQty >= range.min && newQty <= range.max
              );
              let newPrice;
              if (priceRange) {
                newPrice = priceRange.price;
              } else {
                // No exact range found, use the highest range's price
                const sortedRanges = [...product.price_ranges].sort((a, b) => b.max - a.max);
                newPrice = sortedRanges[0].price;
              }
              updatePayload.price = newPrice;
              updatedRecordForUI.price = newPrice;
            } else {
              updatePayload.price = importedPrice;
              updatedRecordForUI.price = importedPrice;
            }
          }

          // Update inventory for quantity change
          if (originalSale.product_id && newQty !== oldQty) {
            const qtyDifference = oldQty - newQty; // If qty increased, we subtract more from inventory (negative change)
            const oldInventory = await updateProductInventory(
              originalSale.product_id,
              qtyDifference
            );
            inventoryChanges.push({
              productId: originalSale.product_id,
              oldInventory,
              newInventory: oldInventory + qtyDifference,
            });
          }
        }

        if (field === "product_id") {
          const newProductId = value;
          const oldProductId = originalSale.product_id;
          const qty = originalSale.qty;

          // Revert inventory for old product (add back the qty)
          if (oldProductId && qty > 0) {
            const oldInventory = await updateProductInventory(
              oldProductId,
              qty
            );
            inventoryChanges.push({
              productId: oldProductId,
              oldInventory,
              newInventory: oldInventory + qty,
            });
          }

          // Deduct inventory for new product
          if (newProductId && qty > 0) {
            const oldInventory = await updateProductInventory(
              newProductId,
              -qty
            );
            inventoryChanges.push({
              productId: newProductId,
              oldInventory,
              newInventory: oldInventory - qty,
            });
          }
        }

        const qty = Number(updatedRecordForUI.qty);
        const price = Number(updatedRecordForUI.price);
        const paid = Number(updatedRecordForUI.paid);
        const total = qty * price;
        const outstanding = total - paid;
        const payment_status = calculatePaymentStatus("Sale", total, paid, 0);

        // Calculate balance change for user
        const oldOutstanding = originalSale.outstanding;
        userBalanceChange = outstanding - oldOutstanding;

        if (userBalanceChange !== 0) {
          oldUserBalance = await updateUserBalance(
            originalSale.member_id,
            userBalanceChange
          );
        }

        const calculatedFields = { total, outstanding, payment_status };

        updatePayload = {
          ...updatePayload,
          ...calculatedFields,
          product_id: updatedRecordForUI.product_id,
          member_id: updatedRecordForUI.member_id,
          payment_status: calculatedFields.payment_status,
        };
        updatedRecordForUI = {
          ...updatedRecordForUI,
          ...calculatedFields,
          payment_status: calculatedFields.payment_status as PaymentStatus,
        };
      } else {
        // Handle Clearance record edits
        if (field === "paid") {
          const user = users.find((u) => u.id === originalSale.member_id);
          const currentBalance = user?.due_balance || 0;
          const oldPaid = originalSale.paid;
          const newPaid = Number(value);

          // Calculate the effective change in payment
          const paymentChange = newPaid - oldPaid;

          if (currentBalance + paymentChange < 0) {
            toast({
              title: "Payment Exceeds Balance",
              description: "Payment amount would exceed user's available balance",
              variant: "destructive",
            });
            // Revert optimistic update
            setSales(prev => prev.map(s => s.id === id ? originalSale : s));
            return;
          }

          userBalanceChange = -paymentChange; // Opposite of payment change
          if (userBalanceChange !== 0) {
            oldUserBalance = await updateUserBalance(
              originalSale.member_id,
              userBalanceChange
            );
          }

          const payment_status = calculatePaymentStatus(
            "Clearance",
            0,
            newPaid,
            currentBalance + paymentChange
          );
          updatePayload.payment_status = payment_status;
          updatedRecordForUI.payment_status = payment_status as PaymentStatus;

          // Check if we need to update pending sales
          await updatePendingSalesStatus(originalSale.member_id);
        }
      }

      // Update the optimistic UI with calculated fields
      setSales(prev => prev.map(s => s.id === id ? updatedRecordForUI : s));

      addToUndoStack({
        type: "edit",
        timestamp: Date.now(),
        data: {
          recordId: id,
          field,
          oldValue: originalSale[field],
          record: originalSale,
          userBalanceChanges:
            userBalanceChange !== 0
              ? [
                  {
                    userId: originalSale.member_id,
                    oldBalance: oldUserBalance,
                    newBalance: oldUserBalance + userBalanceChange,
                  },
                ]
              : undefined,
        },
      });

      const { error } = await supabase
        .from("sales")
        .update(updatePayload)
        .eq("id", id);
      if (error) {
        console.error("Update failed:", error.message);
        // Revert user balance if update fails
        if (userBalanceChange !== 0) {
          await updateUserBalance(originalSale.member_id, -userBalanceChange);
        }
        // Revert optimistic update
        setSales(prev => prev.map(s => s.id === id ? originalSale : s));
      } else {
        // Refresh user data to show updated balances
        fetchDropdownData();
      }
    } catch (error: any) {
      console.error("Edit failed:", error.message);
      toast({
        title: "Edit Failed",
        description: "Edit failed: " + error.message,
        variant: "destructive",
      });
      // Revert optimistic update
      setSales(prev => prev.map(s => s.id === id ? originalSale : s));
    }
  };

  const deleteSelectedRows = async () => {
    if (
      selectedRows.length === 0 ||
      !window.confirm(`Delete ${selectedRows.length} record(s)?`)
    )
      return;

    const deletedRecords = sales.filter((s) => selectedRows.includes(s.id));

    // Optimistically remove from UI
    setSales(prev => prev.filter(s => !selectedRows.includes(s.id)));
    const originalSelectedRows = [...selectedRows];
    setSelectedRows([]);

    try {
      // Calculate user balance changes and handle clearance reversals
      const userBalanceChanges: {
        userId: string;
        oldBalance: number;
        newBalance: number;
      }[] = [];
      const salesRecordReversals: any[] = [];
      const inventoryReverts: { productId: string; revertQty: number }[] = [];

      for (const record of deletedRecords) {
        let balanceChange = 0;

        if (record && record.transaction_type === "Sale") {
          balanceChange = -record.outstanding; // Decrease user's due balance
          // Revert inventory: add back sold qty
          if (record.product_id && record.qty > 0) {
            inventoryReverts.push({ productId: record.product_id, revertQty: record.qty });
          }
        } else if (record) {
          // Clearance - need to reverse the sales record updates
          balanceChange = record.paid; // Increase user's due balance (reverse the clearance)

          // Find which sales records were affected by this clearance and reverse them
          // This is a simplified version - in production, you'd want to store the linkage
          const { data: userSales, error } = await supabase
            .from("sales")
            .select("*")
            .eq("member_id", record.member_id)
            .eq("transaction_type", "Sale")
            .order("date", { ascending: true });

          if (!error && userSales) {
            let remainingAmount = record.paid;
            for (const sale of userSales) {
              if (remainingAmount <= 0) break;
              if (sale.paid > 0) {
                const paymentToReverse = Math.min(remainingAmount, sale.paid);
                const newPaid = sale.paid - paymentToReverse;
                const newOutstanding = sale.total - newPaid;
                const newStatus =
                  newPaid >= sale.total
                    ? "Fully Paid"
                    : newPaid > 0
                    ? "Partially Paid"
                    : "Pending";

                salesRecordReversals.push({
                  id: sale.id,
                  oldPaid: sale.paid,
                  newPaid: newPaid,
                  oldOutstanding: sale.outstanding,
                  newOutstanding: newOutstanding,
                  oldStatus: sale.payment_status,
                  newStatus: newStatus,
                });

                remainingAmount -= paymentToReverse;
              }
            }
          }
        }

        if (balanceChange !== 0) {
          const oldBalance = await updateUserBalance(
            record.member_id,
            balanceChange
          );
          userBalanceChanges.push({
            userId: record.member_id,
            oldBalance,
            newBalance: oldBalance + balanceChange,
          });
        }
      }

      // Apply sales record reversals
      for (const reversal of salesRecordReversals) {
        await supabase
          .from("sales")
          .update({
            paid: reversal.newPaid,
            outstanding: reversal.newOutstanding,
            payment_status: reversal.newStatus,
          })
          .eq("id", reversal.id);
      }

      // Revert inventory for deleted sales
      for (const revert of inventoryReverts) {
        // Get current inventory
        const { data: product, error: prodErr } = await supabase
          .from("products")
          .select("inventory")
          .eq("id", revert.productId)
          .single();
        if (!prodErr && product) {
          const oldInventory = product.inventory || 0;
          const newInventory = oldInventory + revert.revertQty;
          await supabase.from("products").update({ inventory: newInventory }).eq("id", revert.productId);
        }
      }

      addToUndoStack({
        type: "delete",
        timestamp: Date.now(),
        data: {
          deletedRecords,
          userBalanceChanges,
          salesRecordReversals,
        },
      });

      const { error } = await supabase
        .from("sales")
        .delete()
        .in("id", originalSelectedRows);
      if (error) {
        // Revert all changes if delete fails
        for (const change of userBalanceChanges) {
          await updateUserBalance(
            change.userId,
            change.oldBalance - change.newBalance
          );
        }
        for (const reversal of salesRecordReversals) {
          await supabase
            .from("sales")
            .update({
              paid: reversal.oldPaid,
              outstanding: reversal.oldOutstanding,
              payment_status: reversal.oldStatus,
            })
            .eq("id", reversal.id);
        }
        // Revert optimistic update
        setSales(prev => [...deletedRecords, ...prev]);
        setSelectedRows(originalSelectedRows);
        toast({
          title: "Delete Failed",
          description: "Delete failed: " + error.message,
          variant: "destructive",
        });
      } else {
        // Refresh all data
        fetchDropdownData();
      }
    } catch (error: any) {
      // Revert optimistic update
      setSales(prev => [...deletedRecords, ...prev]);
      setSelectedRows(originalSelectedRows);
      toast({
        title: "Delete Failed",
        description: "Delete failed: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    setIsUndoing(true);
    const lastOperation = undoStack[undoStack.length - 1];

    try {
      // Revert user balance changes if any
      if (lastOperation.data.userBalanceChanges) {
        for (const change of lastOperation.data.userBalanceChanges) {
          await supabase
            .from("users")
            .update({ due_balance: change.oldBalance })
            .eq("id", change.userId);
        }
      }

      switch (lastOperation.type) {
        case "delete":
          if (lastOperation.data.deletedRecords) {
            const recordsToRestore = lastOperation.data.deletedRecords.map(
              ({ users, products, ...rec }) => ({
                ...rec,
                date: typeof rec.date === "string" ? rec.date : new Date(rec.date).toISOString().slice(0, 10),
              })
            );
            await supabase.from("sales").insert(
              recordsToRestore.map(rec => ({
                ...rec,
                date: typeof rec.date === "string"
                  ? rec.date
                  : (rec.date && typeof rec.date === "object" && "toISOString" in rec.date && typeof (rec.date as Date).toISOString === "function")
                  ? (rec.date as Date).toISOString().slice(0, 10)
                  : new Date(rec.date as string | number | Date).toISOString().slice(0, 10),
              }))
            );
          }
          break;
        case "add":
          if (lastOperation.data.addedRecord) {
            await supabase
              .from("sales")
              .delete()
              .eq("id", lastOperation.data.addedRecord.id);
          }
          break;
        case "edit":
          if (lastOperation.data.originalRecord) {
            const { users, products, ...recordData } =
              lastOperation.data.originalRecord;
            await supabase
              .from("sales")
              .update({
                ...recordData,
                date: typeof recordData.date === "string" ? recordData.date : new Date(recordData.date).toISOString().slice(0, 10),
              })
              .eq("id", lastOperation.data.originalRecord.id);
          }
          break;
        case "duplicate":
          if (lastOperation.data.duplicatedRecords) {
            const idsToDelete = lastOperation.data.duplicatedRecords.map(
              (r) => r.id
            );
            await supabase.from("sales").delete().in("id", idsToDelete);
          }
          break;
      }

      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [lastOperation, ...prev]);
      fetchSales();
      fetchDropdownData(); // Refresh user balances
    } catch (error: any) {
      toast({
        title: "Undo Failed",
        description: "Undo failed: " + error.message,
        variant: "destructive",
      });
    } finally {
      setIsUndoing(false);
    }
  };

  const handleRedo = async () => {
    if (redoStack.length === 0) return;
    setIsUndoing(true);
    const operationToRedo = redoStack[0];

    try {
      switch (operationToRedo.type) {
        case "add":
          if (operationToRedo.data.addedRecord) {
            const { users, products, ...recordData } =
              operationToRedo.data.addedRecord;
            await supabase.from("sales").insert({
              ...recordData,
              date: typeof recordData.date === "string" ? recordData.date : new Date(recordData.date).toISOString().slice(0, 10),
            });
          }
          break;
        case "delete":
          const idsToDelete = operationToRedo.data.deletedRecords!.map(
            (r) => r.id
          );
          await supabase.from("sales").delete().in("id", idsToDelete);
          break;
        case "edit":
          if (operationToRedo.data.updatedRecord) {
            const { users, products, ...recordData } =
              operationToRedo.data.updatedRecord;
            await supabase
              .from("sales")
              .update({
                ...recordData,
                date: typeof recordData.date === "string" ? recordData.date : new Date(recordData.date).toISOString().slice(0, 10),
              })
              .eq("id", operationToRedo.data.updatedRecord.id);
          }
          break;
        case "duplicate":
          if (operationToRedo.data.duplicatedRecords) {
            const recordsToRestore = operationToRedo.data.duplicatedRecords.map(
              ({ users, products, ...rec }) => ({
                ...rec,
                date: new Date(rec.date),
              })
            );
            await supabase.from("sales").insert(
              recordsToRestore.map(rec => ({
                ...rec,
                date: typeof rec.date === "string"
                  ? rec.date
                  : (rec.date && typeof rec.date === "object" && "toISOString" in rec.date && typeof (rec.date as Date).toISOString === "function")
                  ? (rec.date as Date).toISOString().slice(0, 10)
                  : new Date(rec.date as string | number | Date).toISOString().slice(0, 10),
              }))
            );
          }
          break;
      }

      // Reapply user balance changes
      if (operationToRedo.data.userBalanceChanges) {
        for (const change of operationToRedo.data.userBalanceChanges) {
          await supabase
            .from("users")
            .update({ due_balance: change.newBalance })
            .eq("id", change.userId);
        }
      }

      setRedoStack((prev) => prev.slice(1));
      setUndoStack((prev) => [...prev, operationToRedo]);

      fetchSales();
      fetchDropdownData(); // Refresh user balances
    } catch (error: any) {
      toast({
        title: "Redo Failed",
        description: "Redo failed: " + error.message,
        variant: "destructive",
      });
    } finally {
      setIsUndoing(false);
    }
  };

  const handleExportToExcel = () => {
    if (sortedSales.length === 0) {
      toast({
        title: "No Data",
        description: "No data to export.",
        variant: "destructive",
      });
      return;
    }
    const exportData = sortedSales.map((s) => ({
      Date: s.date,
      "Transaction Type": s.transaction_type,
      Member: s.users?.name || "N/A",
      Product: s.products?.name || "N/A",
      Quantity: s.qty,
      Price: s.price,
      Total: s.total,
      Paid: s.paid,
      Outstanding: s.outstanding,
      "Payment Status": s.payment_status,
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales");
    XLSX.writeFile(workbook, `Sales_Report.xlsx`);
  };

  const handleImportedData = async (importedRows: any[]) => {
    if (!importedRows || importedRows.length === 0) {
      toast({
        title: "No Data Found",
        description: "No data found in the imported file.",
        variant: "destructive",
      });
      return;
    }

    const processedData = importedRows
      .map((row) => {
        const user = users.find((u) => u.name === row.member);
        const product = products.find((p) => p.name === row.product);
        const transactionType = row.transaction_type || "Sale";

        if (!user) {
          console.warn(`Skipping row due to missing user:`, row);
          return null;
        }

        if (transactionType === "Sale" && !product) {
          console.warn(`Skipping Sale row due to missing product:`, row);
          return null;
        }

        if (transactionType === "Sale") {
          const qty = Number(row.qty || 0);
          let price = 0;
          
          // Check if imported row has a valid price, use it if available
          const importedPrice = Number(row.price);
          if (row.price !== null && row.price !== undefined && !isNaN(importedPrice) && importedPrice > 0) {
            price = importedPrice;
            console.log(`Using imported price: ${price} for product: ${product?.name}, qty: ${qty}`);
          } else {
            // Fallback to calculated price based on product price ranges
            if (product && Array.isArray(product.price_ranges) && product.price_ranges.length > 0) {
              const priceRange = product.price_ranges.find(
                (r) => qty >= r.min && qty <= r.max
              );
              if (priceRange) {
                price = priceRange.price;
                console.log(`Found exact price range: ${price} for product: ${product?.name}, qty: ${qty}`);
              } else {
                // No exact range found, use the highest range's price
                const sortedRanges = [...product.price_ranges].sort((a, b) => b.max - a.max);
                price = sortedRanges[0].price;
                console.log(`Using highest range price: ${price} for product: ${product?.name}, qty: ${qty} (exceeds all ranges)`);
              }
            } else if (product) {
              price = product.mrp || 0;
              console.log(`Using MRP: ${price} for product: ${product?.name}, qty: ${qty} (no price ranges)`);
            }
          }

          const paid = Number(row.paid || 0);
          const total = qty * price;
          const outstanding = total - paid;
          const payment_status = calculatePaymentStatus("Sale", total, paid, 0);

          return {
            id: `temp-${Date.now()}-${Math.random()}`,
            date: row.date,
            member_id: user.id,
            product_id: product!.id,
            qty,
            price,
            total,
            paid,
            outstanding,
            payment_status,
            transaction_type: "Sale",
            users: user,
            products: product,
          };
        } else {
          // Clearance
          const paid = Number(row.paid || 0);
          const payment_status = calculatePaymentStatus(
            "Clearance",
            0,
            paid,
            user.due_balance || 0
          );

          return {
            id: `temp-${Date.now()}-${Math.random()}`,
            date: row.date,
            member_id: user.id,
            product_id: null,
            qty: 0,
            price: 0,
            total: 0,
            paid,
            outstanding: 0,
            payment_status,
            transaction_type: "Clearance",
            users: user,
            products: null,
          };
        }
      })
      .filter((row: any) => row !== null);

    if (processedData.length === 0) {
      toast({
        title: "No Valid Rows",
        description: "No valid rows could be processed from the import. Please check user and product names match exactly.",
        variant: "destructive",
      });
      return;
    }

    // Optimistically add to UI
    setSales(prev => [...(processedData as Sale[]), ...prev]);

    try {
      // Calculate and apply user balance changes
      const userBalanceChanges: {
        userId: string;
        oldBalance: number;
        newBalance: number;
      }[] = [];

      for (const record of processedData) {
        let balanceChange = 0;

        if (record && record.transaction_type === "Sale") {
          balanceChange = record.outstanding;
        } else if (record) {
          // Clearance
          balanceChange = -record.paid;
        }

        if (record && balanceChange !== 0) {
          const oldBalance = await updateUserBalance(
            record.member_id,
            balanceChange
          );
          userBalanceChanges.push({
            userId: record.member_id,
            oldBalance,
            newBalance: oldBalance + balanceChange,
          });
        }
      }

      const { data: newRecords, error } = await supabase
        .from("sales")
        .insert(
          processedData
            .filter((record) => record !== null && typeof record === "object")
            .map((record) => {
              // Safely destructure users and products, and ensure date is a string
              const { users, products, id, ...dbRecord } = record as any;
              // Remove temp id before insert
              return {
                ...dbRecord,
                date: typeof dbRecord.date === "string"
                  ? dbRecord.date
                  : (dbRecord.date instanceof Date
                      ? dbRecord.date.toISOString().slice(0, 10)
                      : String(dbRecord.date)),
              };
            }) as Sale[]
        )
        .select("id, date, member_id, product_id, qty, price, total, paid, outstanding, payment_status, transaction_type");

      if (error) {
        // Revert balance changes if insert fails
        for (const change of userBalanceChanges) {
          await updateUserBalance(
            change.userId,
            change.oldBalance - change.newBalance
          );
        }
        // Revert optimistic update
        setSales(prev => prev.filter(s => !s.id.toString().startsWith('temp-')));
        toast({
          title: "Import Failed",
          description: `Import failed: ${error.message}`,
          variant: "destructive",
        });
      } else if (newRecords) {
        // Subtract inventory for each imported sale
        for (const rec of newRecords) {
          if (rec.transaction_type === "Sale" && rec.product_id && rec.qty !== 0) {
            // Get current inventory
            const { data: product, error: prodErr } = await supabase
              .from("products")
              .select("inventory")
              .eq("id", rec.product_id)
              .single();
            if (!prodErr && product) {
              const oldInventory = product.inventory || 0;
              const newInventory = oldInventory - rec.qty;
              await supabase.from("products").update({ inventory: newInventory }).eq("id", rec.product_id);
            }
          }
        }

        toast({
          title: "Import Successful",
          description: `${newRecords.length} rows imported successfully!`,
        });

        const importedSales: Sale[] = (newRecords as any[]).map((rec) => ({
          ...rec,
          users: null,
          products: null,
        }));

        // Replace optimistic records with real data
        setSales(prev => {
          const withoutOptimistic = prev.filter(s => !s.id.toString().startsWith('temp-'));
          return [...importedSales, ...withoutOptimistic];
        });

        addToUndoStack({
          type: "import",
          timestamp: Date.now(),
          data: {
            importedRecords: importedSales,
            userBalanceChanges,
          },
        });

        fetchSales(); // Refresh sales data to show member/product names
        fetchDropdownData(); // Refresh user balances
      }
    } catch (error: any) {
      // Revert optimistic update
      setSales(prev => prev.filter(s => !s.id.toString().startsWith('temp-')));
      toast({
        title: "Import Failed",
        description: `Import failed: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleApplyCustomDate = () => {
    setDate(customDate);
    setDialogOpen(false);
    setPopoverOpen(false);
  };

  // --- UI HANDLERS & MEMOS ---
  const calculatePriceForQuantity = (productId: string, quantity: number): number => {
    const product = products.find((p) => p.id === productId);
    console.log(`calculatePriceForQuantity - Product ID: ${productId}, Quantity: ${quantity}`);
    console.log(`Found product:`, product);
    
    if (!product) return 0;

    // Check if product has price ranges
    if (Array.isArray(product.price_ranges) && product.price_ranges.length > 0) {
      console.log(`Product has price ranges:`, product.price_ranges);
      
      // Find the appropriate price range for the given quantity
      const priceRange = product.price_ranges.find(
        (range) => quantity >= range.min && quantity <= range.max
      );
      
      console.log(`Found price range for qty ${quantity}:`, priceRange);
      
      if (priceRange) {
        console.log(`Returning price from range: ${priceRange.price}`);
        return priceRange.price;
      }
      
      // If no exact range found, try to find the best fit
      // Sort ranges by min value and find the closest applicable range
      const sortedRanges = [...product.price_ranges].sort((a, b) => a.min - b.min);
      console.log(`Sorted ranges:`, sortedRanges);
      
      // If quantity is below the lowest range, use the lowest range price
      if (quantity < sortedRanges[0].min) {
        console.log(`Quantity below lowest range, using lowest price: ${sortedRanges[0].price}`);
        return sortedRanges[0].price;
      }
      
      // If quantity is above all ranges, use the highest range price
      const lastRange = sortedRanges[sortedRanges.length - 1];
      if (quantity > lastRange.max) {
        console.log(`Quantity above highest range, using highest price: ${lastRange.price}`);
        return lastRange.price;
      }
      
      // Find the range where quantity fits (if ranges have gaps)
      for (let i = 0; i < sortedRanges.length - 1; i++) {
        const currentRange = sortedRanges[i];
        const nextRange = sortedRanges[i + 1];
        
        if (quantity >= currentRange.min && quantity <= currentRange.max) {
          console.log(`Found fitting range: ${currentRange.price}`);
          return currentRange.price;
        }
        
        // If quantity falls between ranges, use the lower range price
        if (quantity > currentRange.max && quantity < nextRange.min) {
          console.log(`Quantity between ranges, using lower range price: ${currentRange.price}`);
          return currentRange.price;
        }
      }
    } else {
      console.log(`Product has no price ranges, falling back to MRP: ${product.mrp}`);
    }

    // Fallback to MRP if no price ranges or no suitable range found
    console.log(`Fallback to MRP: ${product.mrp || 0}`);
    return product.mrp || 0;
  };

  const handleNewChange = (field: keyof Sale, value: any) => {
    setNewSale((prev) => {
      const updated = { ...prev, [field]: value };

      // Reset form when transaction type changes
      if (field === "transaction_type") {
        return {
          transaction_type: value,
          date: prev.date,
          member_id: prev.member_id,
        };
      }

      // Handle product selection - set initial price based on current quantity or 1
      if (field === "product_id" && value) {
        const currentQty = prev.qty || 1; // Use current qty or default to 1
        const product = products.find((p) => p.id === value);
        
        if (product) {
          // Calculate price based on product price ranges
          let calculatedPrice = 0;
          if (Array.isArray(product.price_ranges) && product.price_ranges.length > 0) {
            const priceRange = product.price_ranges.find(
              (range) => currentQty >= range.min && currentQty <= range.max
            );
            if (priceRange) {
              calculatedPrice = priceRange.price;
            } else {
              // No exact range found, use the highest range's price
              const sortedRanges = [...product.price_ranges].sort((a, b) => b.max - a.max);
              calculatedPrice = sortedRanges[0].price;
            }
          } else {
            calculatedPrice = product.mrp || 0;
          }
          updated.price = calculatedPrice;
        }
      }

      // Handle quantity change - update price based on new quantity
      if (field === "qty" && value && prev.product_id) {
        const product = products.find((p) => p.id === prev.product_id);
        
        if (product) {
          // Calculate price based on new quantity
          let calculatedPrice = 0;
          if (Array.isArray(product.price_ranges) && product.price_ranges.length > 0) {
            const priceRange = product.price_ranges.find(
              (range) => value >= range.min && value <= range.max
            );
            if (priceRange) {
              calculatedPrice = priceRange.price;
            } else {
              // No exact range found, use the highest range's price
              const sortedRanges = [...product.price_ranges].sort((a, b) => b.max - a.max);
              calculatedPrice = sortedRanges[0].price;
            }
          } else {
            calculatedPrice = product.mrp || 0;
          }
          updated.price = calculatedPrice;
        }
      }

      return updated;
    });
  };

  useEffect(() => {
    if (newSale.transaction_type === "Clearance") {
      // For clearance, only calculate payment status
      const paid = newSale.paid || 0;
      const user = users.find((u) => u.id === newSale.member_id);
      const userBalance = user?.due_balance || 0;
      const payment_status = calculatePaymentStatus(
        "Clearance",
        0,
        paid,
        userBalance
      );

      setNewSale((prev) => ({
        ...prev,
        qty: 0,
        price: 0,
        total: 0,
        outstanding: 0,
        product_id: "",
        payment_status,
      }));
    } else {
      // Sale transaction logic - calculate totals based on current values
      // Don't recalculate price here, use the existing price value
      const qty = newSale.qty || 0;
      const price = newSale.price || 0;
      const paid = newSale.paid || 0;
      const total = qty * price;
      const outstanding = total - paid;
      const payment_status = calculatePaymentStatus("Sale", total, paid, 0);

      setNewSale((prev) => ({
        ...prev,
        total,
        outstanding,
        payment_status,
      }));
    }
  }, [
    newSale.qty,
    newSale.price,
    newSale.paid,
    newSale.transaction_type,
    newSale.member_id,
    users, // Removed products from dependencies to prevent price recalculation
  ]);

  const sortedSales = useMemo(() => {
    let sortableItems = sales.filter((s) => {
      if (!searchTerm) return true;
      const lowerSearch = searchTerm.toLowerCase();
      const userName = s.users?.name || "";
      const productName = s.products?.name || "";
      const transactionType = s.transaction_type || "";
      return (
        userName.toLowerCase().includes(lowerSearch) ||
        productName.toLowerCase().includes(lowerSearch) ||
        transactionType.toLowerCase().includes(lowerSearch)
      );
    });

    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        const getSortValue = (item: Sale, key: string) => {
          if (key === "user") return item.users?.name;
          if (key === "product") return item.products?.name;
          return item[key as keyof Sale];
        };
        const valA = getSortValue(a, sortConfig.key!);
        const valB = getSortValue(b, sortConfig.key!);

        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (valA < valB) return sortConfig.direction === "ascending" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "ascending" ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [sales, searchTerm, sortConfig]);

  const requestSort = (key: string) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const handleRowSelect = (id: string) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedRows.length === sortedSales.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(sortedSales.map((s) => s.id));
    }
  };

  // --- RENDER LOGIC ---

  const renderEditableCell = (sale: Sale, field: keyof Sale) => {
    const isEditing =
      editingCell?.rowId === sale.id && editingCell.field === field;
    const isCalculated = ["total", "outstanding"].includes(field);
    const isReadOnly =
      sale.transaction_type === "Clearance" &&
      !["date", "member_id", "paid", "payment_status"].includes(field);
    const clickHandler =
      isCalculated || isReadOnly
        ? undefined
        : () => setEditingCell({ rowId: sale.id, field });

    if (isEditing) {
      if (field === "payment_status") {
        const statusOptions =
          sale.transaction_type === "Sale"
            ? ["Fully Paid", "Partially Paid", "Pending", "Due Cleared"]
            : ["Partial Clearance", "Complete Clearance"];

        return (
          <TableCell className="p-1">
            <select
              className="w-full p-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-1 focus:ring-blue-500 h-8"
              value={sale.payment_status}
              onChange={(e) => handleEditChange(sale.id, field, e.target.value)}
              onBlur={() => setEditingCell(null)}
              autoFocus
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </TableCell>
        );
      }

      if (field === "member_id" || field === "product_id") {
        const options = field === "member_id" ? userOptions : productOptions;
        return (
          <TableCell className="p-1">
            <Select
              options={options}
              defaultValue={options.find((o) => o.value === sale[field])}
              onChange={(selected: any) =>
                handleEditChange(sale.id, field, selected?.value)
              }
              onBlur={() => setEditingCell(null)}
              autoFocus
              styles={getSelectStyles(isDarkMode)}
              menuPortalTarget={document.body}
            />
          </TableCell>
        );
      }

      return (
        <TableCell className="p-1">
          <Input
            type={field === "date" ? "date" : "number"}
            className="h-8"
            defaultValue={sale[field] as any}
            onBlur={(e) => handleEditChange(sale.id, field, e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && (e.target as HTMLInputElement).blur()
            }
            autoFocus
          />
        </TableCell>
      );
    }

// ...existing code...
        const displayValue =
          field === "member_id"
            ? sale.users?.name
            : field === "product_id"
            ? sale.products?.name
            : field === "date"
            ? format(new Date(sale.date), "dd MMM yyyy") // <-- formatted date
            : sale[field];
// ...existing code...

    const isCurrency = ["price", "total", "paid", "outstanding"].includes(
      field
    );

    if (field === "payment_status") {
      return (
        <TableCell
          className={cn(
            "font-semibold",
            statusColors[sale.payment_status],
            isReadOnly ? "cursor-default" : "cursor-pointer"
          )}
          onClick={clickHandler}
        >
          {sale.payment_status}
        </TableCell>
      );
    }

    if (field === "transaction_type") {
      return (
        <TableCell>
          <span
            className={cn(
              "px-2 py-1 rounded-full text-xs font-medium",
              transactionTypeColors[sale.transaction_type]
            )}
          >
            {sale.transaction_type}
          </span>
        </TableCell>
      );
    }

    return (
      <TableCell
        className={cn(
          isReadOnly ? "cursor-default text-gray-500" : "cursor-pointer",
          isCurrency && "text-right"
        )}
        onClick={clickHandler}
      >
        {isCurrency
          ? formatCurrency(Number(displayValue))
          : String(displayValue ?? "")}
      </TableCell>
    );
  };

  const renderProductSection = () => {
    const transactionType = newSale.transaction_type || "Sale";
    const selectedMemberPendingSales = newSale.member_id
      ? getPendingSalesForMember(newSale.member_id)
      : [];

    if (transactionType === "Sale") {
      return (
        <Select
          options={productOptions}
          onChange={(s: any) =>
            handleNewChange("product_id" as keyof Sale, s?.value || "")
          }
          styles={getSelectStyles(isDarkMode)}
          placeholder="Select product..."
        />
      );
    } else {
      // For clearance, show the products that have pending amounts
      if (newSale.member_id && selectedMemberPendingSales.length > 0) {
        const maxVisible = 3;
        const isExpanded = showMoreProducts === newSale.member_id;
        const visibleProducts = isExpanded
          ? selectedMemberPendingSales
          : selectedMemberPendingSales.slice(0, maxVisible);
        const hasMore = selectedMemberPendingSales.length > maxVisible;

        return (
          <div className="space-y-1">
            {selectedMemberPendingSales.length === 1 ? (
              // If only one pending sale, show the product name directly
              <div className="text-gray-700 dark:text-gray-300 font-medium">
                {selectedMemberPendingSales[0].productName}
              </div>
            ) : (
              // If multiple pending sales, show limited list with show more option
              <div className="text-gray-700 dark:text-gray-300">
                <div className="font-medium mb-1">Multiple Products:</div>
                <div className="text-xs space-y-1">
                  {visibleProducts.map((sale, index) => (
                    <div
                      key={index}
                      className="text-gray-600 dark:text-gray-400"
                    >
                      • {sale.productName}
                    </div>
                  ))}
                  {hasMore && !isExpanded && (
                    <button
                      type="button"
                      onClick={() => setShowMoreProducts(newSale.member_id!)}
                      className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium underline"
                    >
                      Show {selectedMemberPendingSales.length - maxVisible}{" "}
                      more...
                    </button>
                  )}
                  {isExpanded && hasMore && (
                    <button
                      type="button"
                      onClick={() => setShowMoreProducts(null)}
                      className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium underline"
                    >
                      Show less
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      } else {
        return (
          <span className="text-gray-400 text-sm">
            {newSale.member_id ? "No pending sales" : "Select member first"}
          </span>
        );
      }
    }
  };

  const renderNewRecordRow = () => {
    const transactionType = newSale.transaction_type || "Sale";
    const selectedMemberPendingSales = newSale.member_id
      ? getPendingSalesForMember(newSale.member_id)
      : [];

    // Modern calendar UI for date selection
    return (
      <TableRow className="bg-secondary">
        <TableCell></TableCell>
        <TableCell className="p-1">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-8",
                  !newSale.date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {newSale.date
                  ? (() => {
                      const d = new Date(newSale.date);
                      return isNaN(d.getTime()) ? "Pick a date" : d.toLocaleDateString();
                    })()
                  : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={newSale.date ? new Date(newSale.date) : undefined}
                onSelect={(date) => {
                  if (date) {
                    handleNewChange("date" as keyof Sale, date.toISOString().slice(0, 10));
                    setCalendarOpen(false);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </TableCell>
        <TableCell className="p-1">
          <Select
            options={transactionTypeOptions}
            value={transactionTypeOptions.find(
              (opt) => opt.value === transactionType
            )}
            onChange={(s: any) =>
              handleNewChange("transaction_type" as keyof Sale, s?.value)
            }
            styles={getSelectStyles(isDarkMode)}
            placeholder="Select type..."
          />
        </TableCell>
        <TableCell className="p-1 min-w-[200px]">
          <div className="space-y-1">
            <Select
              options={getClearanceUserOptions}
              onChange={(s: any) =>
                handleNewChange("member_id" as keyof Sale, s?.value)
              }
              styles={getSelectStyles(isDarkMode)}
              placeholder={
                transactionType === "Clearance"
                  ? "Select member with dues..."
                  : "Select member..."
              }
              noOptionsMessage={() =>
                transactionType === "Clearance"
                  ? "No members with outstanding dues"
                  : "No members found"
              }
            />
            {/* Show pending sales details for clearance transactions */}
            {transactionType === "Clearance" &&
              newSale.member_id &&
              selectedMemberPendingSales.length > 0 && (
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded border max-h-32 overflow-y-auto">
                  <div className="font-semibold mb-2 text-gray-800 dark:text-gray-200">
                    Pending Sales ({selectedMemberPendingSales.length} items):
                  </div>
                  <div className="space-y-1">
                    {selectedMemberPendingSales.map((sale, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-700 dark:text-gray-300 truncate">
                            {sale.productName}
                          </div>
                          <div className="text-gray-500 dark:text-gray-400 text-xs">
                            {new Date(sale.date).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="font-semibold text-red-600 dark:text-red-400 ml-2">
                          ₹{sale.outstanding.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-300 dark:border-gray-600 pt-2 mt-2">
                    <div className="flex justify-between items-center font-semibold text-gray-800 dark:text-gray-200">
                      <span>Total Due:</span>
                      <span className="text-red-600 dark:text-red-400">
                        ₹
                        {selectedMemberPendingSales
                          .reduce((sum, sale) => sum + sale.outstanding, 0)
                          .toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </TableCell>
        <TableCell className="p-1 min-w-[150px]">
          {renderProductSection()}
        </TableCell>
        <TableCell className="p-1">
          {transactionType === "Sale" ? (
            <Input
              type="number"
              className="h-8 w-16 text-right"
              value={newSale.qty ?? ""}
              onChange={(e) =>
                handleNewChange("qty" as keyof Sale, Number(e.target.value))
              }
            />
          ) : (
            <span className="text-gray-400 text-sm">0</span>
          )}
        </TableCell>
        <TableCell className="p-1">
          {transactionType === "Sale" ? (
            <Input
              type="number"
              step="0.01"
              className="h-8 w-24 text-right"
              value={newSale.price ?? ""}
              onChange={(e) =>
                handleNewChange("price" as keyof Sale, Number(e.target.value))
              }
            />
          ) : (
            <span className="text-gray-400 text-sm">₹0.00</span>
          )}
        </TableCell>
        <TableCell className="p-1 text-right">
          {transactionType === "Sale"
            ? formatCurrency(newSale.total ?? 0)
            : "₹0.00"}
        </TableCell>
        <TableCell className="p-1">
          <div className="space-y-1">
            <Input
              type="number"
              step="0.01"
              className="h-8 w-24 text-right"
              value={newSale.paid ?? ""}
              onChange={(e) =>
                handleNewChange("paid" as keyof Sale, Number(e.target.value))
              }
              placeholder={
                transactionType === "Clearance" ? "Amount to clear" : "0"
              }
              max={
                transactionType === "Clearance" && newSale.member_id
                  ? membersWithDues.find((m) => m.userId === newSale.member_id)
                      ?.totalDue
                  : undefined
              }
            />
            {/* Show maximum clearable amount */}
            {transactionType === "Clearance" && newSale.member_id && (
              <div className="text-xs text-gray-500">
                Max: ₹
                {membersWithDues
                  .find((m) => m.userId === newSale.member_id)
                  ?.totalDue.toFixed(2) || "0.00"}
              </div>
            )}
          </div>
        </TableCell>
        <TableCell className="p-1 text-right">
          {transactionType === "Sale"
            ? formatCurrency(newSale.outstanding ?? 0)
            : "₹0.00"}
        </TableCell>
        <TableCell className="p-1">
          <div
            className={cn(
              "font-semibold",
              statusColors[newSale.payment_status || "Pending"]
            )}
          >
            {newSale.payment_status || "Pending"}
          </div>
        </TableCell>
        <TableCell className="p-1 text-right">
          <div className="flex gap-2 justify-end">
            <Button
              onClick={handleAddNew}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={
                transactionType === "Clearance" &&
                (!newSale.member_id ||
                  !newSale.paid ||
                  (membersWithDues.find((m) => m.userId === newSale.member_id)
                    ?.totalDue || 0) === 0)
              }
            >
              Save
            </Button>
            <Button
              onClick={() => {
                setAddingNew(false);
                setNewSale({});
              }}
              variant="ghost"
              size="sm"
            >
              Cancel
            </Button>
          </div>
          
        </TableCell>
      </TableRow>
    );
  };

  const handleSimpleDuplicate = async () => {
    if (selectedRows.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select records to duplicate",
        variant: "destructive",
      });
      return;
    }

    const selectedSales = sales.filter((sale) =>
      selectedRows.includes(sale.id)
    );

    try {
      const recordsToInsert = [];
      const userBalanceChanges: {
        userId: string;
        oldBalance: number;
        newBalance: number;
      }[] = [];

      for (const sale of selectedSales) {
        if (sale.transaction_type === "Sale") {
          // For sales, duplicate with today's date and 0 paid amount
          const qty = sale.qty;
          const price = sale.price;
          const total = qty * price;
          const paid = 0; // Default to 0 for duplicated records
          const outstanding = total - paid;
          const payment_status = calculatePaymentStatus("Sale", total, paid, 0);

          // Update user balance
          const userBalanceChange = outstanding;
          if (userBalanceChange !== 0) {
            const oldBalance = await updateUserBalance(
              sale.member_id,
              userBalanceChange
            );
            userBalanceChanges.push({
              userId: sale.member_id,
              oldBalance,
              newBalance: oldBalance + userBalanceChange,
            });
          }

          recordsToInsert.push({
            date: new Date().toISOString(),
            member_id: sale.member_id,
            product_id: sale.product_id,
            qty,
            price,
            total,
            paid,
            outstanding,
            payment_status,
            transaction_type: "Sale",
          });
        } else {
          // For clearance, we won't duplicate as it doesn't make business sense
          toast({
            title: "Cannot Duplicate",
            description: "Clearance records cannot be duplicated. Only Sale records will be duplicated.",
            variant: "destructive",
          });
          continue;
        }
      }

      if (recordsToInsert.length === 0) {
        toast({
          title: "No Valid Records",
          description: "No valid records to duplicate",
          variant: "destructive",
        });
        return;
      }

      // Insert all records
      const { data, error } = await supabase
        .from("sales")
        .insert(
          recordsToInsert.map((record) => ({
            ...record,
            date: typeof record.date === "string" ? record.date : new Date(record.date).toISOString(),
          }))
        )
        .select("*, users(*), products(*)");

      if (error) {
        // Revert balance changes if insert fails
        for (const change of userBalanceChanges) {
          await updateUserBalance(
            change.userId,
            change.oldBalance - change.newBalance
          );
        }
        toast({
          title: "Duplication Failed",
          description: "Duplication failed: " + error.message,
          variant: "destructive",
        });
      } else if (data) {
        const duplicatedRecords: Sale[] = data.map((rawRecord: any) => ({
          id: rawRecord.id,
          date: String(rawRecord.date),
          qty: rawRecord.qty || 0,
          price: rawRecord.price || 0,
          total: rawRecord.total,
          paid: rawRecord.paid,
          outstanding: rawRecord.outstanding,
          payment_status: rawRecord.payment_status as PaymentStatus,
          member_id: rawRecord.member_id,
          product_id: rawRecord.product_id || null,
          transaction_type: rawRecord.transaction_type as TransactionType,
          users:
            rawRecord.users && typeof rawRecord.users === "object"
              ? {
                  id: rawRecord.users.id,
                  name: rawRecord.users.name,
                  email: rawRecord.users.email,
                  role: rawRecord.users.role,
                  due_balance: rawRecord.users.due_balance,
                }
              : null,
          products:
            rawRecord.products && typeof rawRecord.products === "object"
              ? {
                  id: rawRecord.products.id,
                  name: rawRecord.products.name,
                  mrp: rawRecord.products.mrp,
                  sku_id: rawRecord.products.sku_id || undefined,
                  price_ranges: rawRecord.products.price_ranges,
                  inventory: rawRecord.products.inventory || 0,
                }
              : null,
        }));

        addToUndoStack({
          type: "duplicate",
          timestamp: Date.now(),
          data: {
            duplicatedRecords,
            userBalanceChanges,
          },
        });

        setSales([...duplicatedRecords, ...sales]);
        setSelectedRows([]);

        // Refresh data
        fetchSales();
        fetchDropdownData();
        fetchMembersWithDues();

        toast({
          title: "Duplication Successful",
          description: `${duplicatedRecords.length} record(s) duplicated successfully with today's date!`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Duplication Failed",
        description: "Duplication failed: " + error.message,
        variant: "destructive",
      });
      console.error("Duplication error:", error);
    }
  };


return (

    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6 ">
      <div className="healthcare-card fade-in-up flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4">
        <div className="flex items-center gap-3 min-w-0">
    <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              <div className="flex flex-col min-w-0">
            <span className="text-lg sm:text-xl font-bold text-foreground leading-tight truncate">Sales Management</span>
            <span className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-snug truncate max-w-[220px] sm:max-w-none">Manage your sales transactions, track payments, and analyze performance.</span>
          </div>
          <div>
    </div>
  </div>
  
  {/* Add this new button */}
  <Button 
    onClick={() => {
      setAddingNew(true);
      setNewSale((prev) => ({
        ...prev,
        date: new Date().toISOString().slice(0, 10),
      }));
    }} 
    className="bg-primary hover:bg-primary/90"
    disabled={addingNew}
  >
    <Plus className="h-4 w-4 mr-2" />
    New Sales Record
  </Button>
</div>

    
    <div className="space-y-6">
      <EnhancedSalesDashboard data={sortedSales} />
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <CardTitle className="text-2xl">Transaction Records</CardTitle>
              {isMonthYearFilter ? (
                <div className="flex items-center gap-2 text-muted-foreground border rounded-lg px-3 py-1">
                  <CalendarIcon className="h-4 w-4" />
                  <span className="font-semibold">
                    {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground border rounded-lg px-3 py-1">
                  <CalendarIcon className="h-4 w-4" />
                  <span className="font-semibold">Custom Range</span>
                </div>
              )}
              {/* {displayDate && (
                <div className="flex items-center gap-2 text-muted-foreground border rounded-lg px-3 py-1">
                  <CalendarIcon className="h-4 w-4" />
                  <span className="font-semibold">{displayDate}</span>
                </div>
              )} */}
            </div>
          </div>

          {/* Month/Year Filter Tabs */}
          <div className="space-y-4 mt-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <UISelect value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => {
                      const year = new Date().getFullYear() - 5 + i;
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </UISelect>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMonthYearFilter(false)}
                  className="flex items-center gap-2"
                >
                  <CalendarIcon className="h-4 w-4" />
                  Custom Range
                </Button>
              </div>
            </div>

            <Tabs value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))} className="w-full">
              <TabsList className="grid w-full grid-cols-6 sm:grid-cols-12 gap-1 h-auto p-1">
                <TabsTrigger value="1" className="text-xs px-1 py-2">Jan</TabsTrigger>
                <TabsTrigger value="2" className="text-xs px-1 py-2">Feb</TabsTrigger>
                <TabsTrigger value="3" className="text-xs px-1 py-2">Mar</TabsTrigger>
                <TabsTrigger value="4" className="text-xs px-1 py-2">Apr</TabsTrigger>
                <TabsTrigger value="5" className="text-xs px-1 py-2">May</TabsTrigger>
                <TabsTrigger value="6" className="text-xs px-1 py-2">Jun</TabsTrigger>
                <TabsTrigger value="7" className="text-xs px-1 py-2">Jul</TabsTrigger>
                <TabsTrigger value="8" className="text-xs px-1 py-2">Aug</TabsTrigger>
                <TabsTrigger value="9" className="text-xs px-1 py-2">Sep</TabsTrigger>
                <TabsTrigger value="10" className="text-xs px-1 py-2">Oct</TabsTrigger>
                <TabsTrigger value="11" className="text-xs px-1 py-2">Nov</TabsTrigger>
                <TabsTrigger value="12" className="text-xs px-1 py-2">Dec</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4 mt-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user, product, or transaction type..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {!isMonthYearFilter && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMonthYearFilter(true)}
                  className="flex items-center gap-2"
                >
                  ← Back to Monthly
                </Button>
                <Popover open={isPopoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-[300px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from
                    ? date.to
                      ? `${date.from.toLocaleDateString()} - ${date.to.toLocaleDateString()}`
                      : date.from.toLocaleDateString()
                    : "Pick a date range"}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 flex"
                side="bottom"
                align="start"
              >
                <div className="flex flex-col space-y-1 p-2 border-r min-w-[140px] bg-muted/40 rounded-l-lg">
                  <Button
                    variant="ghost"
                    className="justify-start rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-lavender/20 focus:bg-lavender/30 focus:outline-none"
                    onClick={() => {
                      const now = new Date();
                      setDate({
                        from: new Date(now.getFullYear(), now.getMonth(), 1),
                        to: addDays(new Date(), 0),
                      });
                      setPopoverOpen(false);
                    }}
                  >
                    This Month
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-start rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-lavender/20 focus:bg-lavender/30 focus:outline-none"
                    onClick={() => {
                      const now = new Date();
                      const lastMonth = new Date(
                        now.getFullYear(),
                        now.getMonth() - 1,
                        1
                      );
                      const lastMonthEnd = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        0
                      );
                      setDate({
                        from: lastMonth,
                        to: lastMonthEnd,
                      });
                      setPopoverOpen(false);
                    }}
                  >
                    Last Month
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-start rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-lavender/20 focus:bg-lavender/30 focus:outline-none"
                    onClick={() => {
                      setDate({
                        from: subMonths(new Date(), 6),
                        to: new Date(),
                      });
                      setPopoverOpen(false);
                    }}
                  >
                    Last 6 Months
                  </Button>

                  <Button
                    variant="ghost"
                    className="justify-start rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-lavender/20 focus:bg-lavender/30 focus:outline-none"
                    onClick={() => {
                      const now = new Date();
                      setDate({
                        from: new Date(now.getFullYear(), 0, 1),
                        to: addDays(new Date(), 0),
                      });
                      setPopoverOpen(false);
                    }}
                  >
                    This Year
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-start rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-lavender/20 focus:bg-lavender/30 focus:outline-none"
                    onClick={() => {
                      setDate({
                        from: new Date(2000, 0, 1),
                        to: addDays(new Date(), 0),
                      });
                      setPopoverOpen(false);
                    }}
                  >
                    All Time
                  </Button>
                </div>
                <div className="p-2 bg-muted/40 rounded-r-lg">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      From
                    </label>
                    <input
                      type="date"
                      value={
                        date?.from ? date.from.toISOString().slice(0, 10) : ""
                      }
                      onChange={(e) => {
                        const newFrom = e.target.value
                          ? new Date(e.target.value)
                          : undefined;
                        setDate((prev) => ({ ...prev, from: newFrom! }));
                      }}
                      className="border border-lavender/30 focus:border-lavender rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-lavender/40 transition-colors"
                    />
                    <label className="text-xs font-medium text-muted-foreground">
                      To
                    </label>
                    <input
                      type="date"
                      value={date?.to ? date.to.toISOString().slice(0, 10) : ""}
                      onChange={(e) => {
                        const newTo = e.target.value
                          ? new Date(e.target.value)
                          : undefined;
                        setDate((prev) =>
                          prev && prev.from
                            ? { ...prev, to: newTo! }
                            : newTo
                            ? { from: newTo, to: newTo }
                            : prev
                        );
                      }}
                      className="border border-lavender/30 focus:border-lavender rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-lavender/40 transition-colors"
                    />
                    <Button
                      type="button"
                      onClick={() => setPopoverOpen(false)}
                      className="mt-2 bg-lavender/80 hover:bg-lavender text-white font-semibold rounded-md"
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
              </div>
            )}
            

            <div className="flex items-center gap-2">
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleRedo}
                      variant="outline"
                      size="sm"
                      disabled={redoStack.length === 0 || isUndoing}
                    >
                      <Redo className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Redo</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleUndo}
                      variant="outline"
                      size="sm"
                      disabled={undoStack.length === 0 || isUndoing}
                    >
                      <Undo className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Undo</p>
                  </TooltipContent>
                </Tooltip>
                <ExcelImport onDataParsed={handleImportedData} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleExportToExcel}
                      variant="outline"
                      size="sm"
                      data-command-export-btn
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Export</p>
                  </TooltipContent>
                </Tooltip>

                {/* Add New sales Record */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => setAddingNew(true)}
                      size="sm"
                      disabled={addingNew}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Add new</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Button
                          variant="ghost"
                          size="icon"
                          onClick={deleteSelectedRows}
                          disabled={selectedRows.length === 0}
                        >
                          <Trash2 className="h-4 w-4" />
             </Button>
          </div>
          
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative h-[calc(100vh-100px)]">
            <div className="absolute inset-0 overflow-y-auto ">
              <div className="min-w-full ">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-[16px] px-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSelectAll}
                          className="text-xs font-medium"
                        >
                          {selectedRows.length === sortedSales.length &&
                          sortedSales.length > 0
                            ? "All"
                            : "All"}
                        </Button>
                      </TableHead>
                      <TableHead
                        onClick={() => requestSort("date")}
                        className="cursor-pointer"
                      >
                        Date
                      </TableHead>
                      <TableHead
                        onClick={() => requestSort("transaction_type")}
                        className="cursor-pointer"
                      >
                        Type
                      </TableHead>
                      <TableHead
                        onClick={() => requestSort("user")}
                        className="cursor-pointer w-[250px] min-w-[200px]"
                      >
                        Member
                      </TableHead>
                      <TableHead
                        onClick={() => requestSort("product")}
                        className="cursor-pointer w-[300px] min-w-[250px]"
                      >
                        Product
                      </TableHead>
                      <TableHead
                        onClick={() => requestSort("qty")}
                        className="text-right cursor-pointer"
                      >
                        Qty
                      </TableHead>
                      <TableHead
                        onClick={() => requestSort("price")}
                        className="text-right cursor-pointer"
                      >
                        Price
                      </TableHead>
                      <TableHead
                        onClick={() => requestSort("total")}
                        className="text-right cursor-pointer"
                      >
                        Payables
                      </TableHead>
                      <TableHead
                        onClick={() => requestSort("paid")}
                        className="text-right cursor-pointer"
                      >
                        Paid
                      </TableHead>
                      <TableHead
                        onClick={() => requestSort("outstanding")}
                        className="text-right cursor-pointer"
                      >
                        Outstanding
                      </TableHead>
                      <TableHead
                        onClick={() => requestSort("payment_status")}
                        className="cursor-pointer"
                      >
                        Status
                      </TableHead>
                      <TableHead className="text-right pr-4">
                        <Button
                          onClick={handleSimpleDuplicate}
                          variant="outline"
                          size="sm"
                          disabled={selectedRows.length === 0}
                          title="Duplicate selected records with today's date"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </TableHead>

                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {addingNew && renderNewRecordRow()}
                    {sortedSales.length > 0 ? (
                      sortedSales.map((sale) => (
                        <TableRow
                          key={sale.id}
                          data-state={
                            selectedRows.includes(sale.id)
                              ? "selected"
                              : undefined
                          }
                        >
                          <TableCell className="px-4">
                            <div
                              onClick={() => handleRowSelect(sale.id)}
                              className={cn(
                                "w-8 h-8 flex items-center justify-center cursor-pointer transition-all rounded-md font-medium text-sm",
                                selectedRows.includes(sale.id)
                                  ? "bg-indigo-600 text-white"
                                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-indigo-100 dark:hover:bg-indigo-900"
                              )}
                            >
                              {sortedSales.findIndex((s) => s.id === sale.id) +
                                1}
                            </div>
                          </TableCell>
                          {renderEditableCell(sale, "date")}
                          {renderEditableCell(sale, "transaction_type")}
                          {renderEditableCell(sale, "member_id")}
                          {renderEditableCell(sale, "product_id")}
                          {renderEditableCell(sale, "qty")}
                          {renderEditableCell(sale, "price")}
                          {renderEditableCell(sale, "total")}
                          {renderEditableCell(sale, "paid")}
                          {renderEditableCell(sale, "outstanding")}
                          {renderEditableCell(sale, "payment_status")}
                          <TableCell></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center h-24">
                          No data available for the selected period.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 overflow-x-auto border-t bg-background">
              <div
                className="min-w-full"
                style={{ width: "max-content", height: "1px" }}
              ></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
      </div>
  );
};

export default SalesTable;
