import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { addDays, format, subMonths, subYears } from 'date-fns';
import { DateRange } from 'react-day-picker';
import * as XLSX from 'xlsx';
import Select from 'react-select';
import EnhancedSalesDashboard from './EnhancedSalesDashboard';
import ExcelImport from './ExcelImport';
import { Search, Upload, Trash2, Plus, Undo, Redo, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";

// --- CONSTANTS ---
const MAX_UNDO_OPERATIONS = 10;

const PAYMENT_STATUSES = {
  FULLY_PAID: 'Fully Paid',
  PARTIALLY_PAID: 'Partially Paid',
  PENDING: 'Pending',
  PARTIAL_CLEARANCE: 'Partial Clearance',
  COMPLETE_CLEARANCE: 'Complete Clearance',
  DUE_CLEARED: 'Due Cleared',
} as const;

const TRANSACTION_TYPES = {
  SALE: 'Sale',
  CLEARANCE: 'Clearance',
} as const;

// --- TYPE DEFINITIONS ---
interface Product {
  id: string;
  name: string;
  mrp: number | null;
  sku_id?: string;
  price_ranges: { min: number; max: number; price: number }[] | null;
}

interface User {
  id: string;
  name: string | null;
  email?: string;
  role?: string;
  due_balance?: number;
}

type TransactionType = typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES];
type PaymentStatus = typeof PAYMENT_STATUSES[keyof typeof PAYMENT_STATUSES];

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
  product_id: string;
  transaction_type: TransactionType;
  users: User | null;
  products: Product | null;
}

interface UndoOperation {
  type: 'delete' | 'add' | 'edit' | 'import';
  timestamp: number;
  data: {
    deletedRecords?: Sale[];
    addedRecord?: Sale;
    importedRecords?: Sale[];
    recordId?: string;
    field?: keyof Sale;
    oldValue?: any;
    record?: Sale;
    originalRecord?: Sale;
    updatedRecord?: Sale;
    userBalanceChanges?: { userId: string; oldBalance: number; newBalance: number }[];
    salesRecordReversals?: any[];
  };
}

interface MemberWithDues {
  userId: string;
  userName: string;
  totalDue: number;
  pendingSales: { productName: string; outstanding: number; date: string; saleId?: string }[];
}

// --- UTILITY FUNCTIONS ---
const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);

const isValidPaymentStatus = (status: string): status is PaymentStatus => {
  return Object.values(PAYMENT_STATUSES).includes(status as PaymentStatus);
};

const isValidTransactionType = (type: string): type is TransactionType => {
  return Object.values(TRANSACTION_TYPES).includes(type as TransactionType);
};

const validateNumberInput = (value: any, fieldName: string): number => {
  const num = Number(value);
  if (isNaN(num)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  if (num < 0) {
    throw new Error(`${fieldName} cannot be negative`);
  }
  return num;
};

const validateSaleInput = (sale: Partial<Sale>): string[] => {
  const errors: string[] = [];
  
  if (!sale.date) errors.push('Date is required');
  if (!sale.member_id) errors.push('Member is required');
  
  if (sale.transaction_type === TRANSACTION_TYPES.SALE) {
    if (!sale.product_id) errors.push('Product is required for sales');
    if (!sale.qty || sale.qty <= 0) errors.push('Quantity must be positive');
    if (!sale.price || sale.price < 0) errors.push('Price cannot be negative');
  }
  
  return errors;
};

// --- STYLE CONFIGURATIONS ---
const statusColors: Record<PaymentStatus, string> = {
  [PAYMENT_STATUSES.FULLY_PAID]: 'text-green-600 dark:text-green-400',
  [PAYMENT_STATUSES.PARTIALLY_PAID]: 'text-yellow-600 dark:text-yellow-400',
  [PAYMENT_STATUSES.PENDING]: 'text-red-600 dark:text-red-400',
  [PAYMENT_STATUSES.PARTIAL_CLEARANCE]: 'text-blue-600 dark:text-blue-400',
  [PAYMENT_STATUSES.COMPLETE_CLEARANCE]: 'text-green-600 dark:text-green-400',
  [PAYMENT_STATUSES.DUE_CLEARED]: 'text-gray-600 dark:text-gray-400',
};

const transactionTypeColors: Record<TransactionType, string> = {
  [TRANSACTION_TYPES.SALE]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  [TRANSACTION_TYPES.CLEARANCE]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
};

const getSelectStyles = (isDark: boolean) => ({
  control: (provided: any) => ({
    ...provided,
    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
    borderColor: isDark ? '#4B5563' : '#D1D5DB',
  }),
  menu: (provided: any) => ({
    ...provided,
    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: state.isSelected ? '#3B82F6' : state.isFocused ? (isDark ? '#374151' : '#F3F4F6') : 'transparent',
    color: state.isSelected ? '#FFFFFF' : (isDark ? '#F9FAFB' : '#111827'),
  }),
  singleValue: (provided: any) => ({ ...provided, color: isDark ? '#F9FAFB' : '#111827' }),
  input: (provided: any) => ({ ...provided, color: isDark ? '#F9FAFB' : '#111827' }),
});

const transactionTypeOptions = [
  { label: TRANSACTION_TYPES.SALE, value: TRANSACTION_TYPES.SALE },
  { label: TRANSACTION_TYPES.CLEARANCE, value: TRANSACTION_TYPES.CLEARANCE }
];

// --- MAIN COMPONENT ---
const SalesTable: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [sales, setSales] = useState<Sale[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [userOptions, setUserOptions] = useState<{ label: string; value: string }[]>([]);
  const [productOptions, setProductOptions] = useState<{ label: string; value: string }[]>([]);
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: keyof Sale } | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newSale, setNewSale] = useState<Partial<Sale>>({});
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: addDays(new Date(), 0),
  });
  const [customDate, setCustomDate] = useState<DateRange | undefined>(date);
  const [isPopoverOpen, setPopoverOpen] = useState(false);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [undoStack, setUndoStack] = useState<UndoOperation[]>([]);
  const [redoStack, setRedoStack] = useState<UndoOperation[]>([]);
  const [isUndoing, setIsUndoing] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'ascending' | 'descending' }>({
    key: 'date',
    direction: 'descending',
  });
  const [membersWithDues, setMembersWithDues] = useState<MemberWithDues[]>([]);
  const [selectedProductsForClearance, setSelectedProductsForClearance] = useState<{
    [saleId: string]: { selected: boolean; amountToClear: number }
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- HELPER FUNCTIONS ---
  const showError = (message: string) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  };

  const addToUndoStack = useCallback((operation: UndoOperation) => {
    if (isUndoing) return;
    setUndoStack(prev => [...prev, operation].slice(-MAX_UNDO_OPERATIONS));
    setRedoStack([]);
  }, [isUndoing]);

  const updateUserBalance = async (userId: string, amountChange: number): Promise<number> => {
    try {
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('due_balance')
        .eq('id', userId)
        .single();

      if (fetchError) throw fetchError;

      const oldBalance = currentUser?.due_balance || 0;
      const newBalance = oldBalance + amountChange;

      const { error: updateError } = await supabase
        .from('users')
        .update({ due_balance: newBalance })
        .eq('id', userId);

      if (updateError) throw updateError;

      return oldBalance;
    } catch (error) {
      console.error('Error updating user balance:', error);
      throw error;
    }
  };

  const calculatePaymentStatus = (transactionType: TransactionType, total: number, paid: number, userBalance: number): PaymentStatus => {
    if (transactionType === TRANSACTION_TYPES.SALE) {
      if (paid >= total) return PAYMENT_STATUSES.FULLY_PAID;
      if (paid > 0) return PAYMENT_STATUSES.PARTIALLY_PAID;
      return PAYMENT_STATUSES.PENDING;
    } else {
      const newBalance = userBalance - paid;
      if (newBalance <= 0) return PAYMENT_STATUSES.COMPLETE_CLEARANCE;
      return PAYMENT_STATUSES.PARTIAL_CLEARANCE;
    }
  };

  // --- DATA FETCHING ---
  const fetchSales = useCallback(async () => {
    if (!date?.from || !date?.to) return;

    setIsLoading(true);
    setError(null);

    try {
      const startDate = date.from.toISOString();
      const endDate = date.to.toISOString();

      const { data, error } = await supabase
        .from('sales')
        .select('*, users(*), products(*)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) throw error;

      const processedSales = (data || [])
        .filter((row: any) => row && typeof row === 'object' && row.payment_status !== undefined)
        .map((row: any): Sale => ({
          id: row.id,
          date: row.date,
          qty: row.qty || 0,
          price: row.price || 0,
          total: row.total,
          paid: row.paid,
          outstanding: row.outstanding,
          payment_status: isValidPaymentStatus(row.payment_status) ? row.payment_status : PAYMENT_STATUSES.PENDING,
          member_id: row.member_id,
          product_id: row.product_id || '',
          transaction_type: isValidTransactionType(row.transaction_type) ? row.transaction_type : TRANSACTION_TYPES.SALE,
          users: row.users && typeof row.users === 'object' ? row.users : null,
          products: row.products && typeof row.products === 'object' ? row.products : null,
        }));

      setSales(processedSales);
    } catch (error: any) {
      console.error('Error fetching sales:', error);
      showError(`Error fetching sales: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  const fetchDropdownData = useCallback(async () => {
    try {
      const usersPromise = supabase.from('users').select('id, name, due_balance');
      const productsPromise = supabase.from('products').select('id, name, mrp, price_ranges');

      const [usersResult, productsResult] = await Promise.all([usersPromise, productsPromise]);

      if (usersResult.error) throw usersResult.error;
      if (productsResult.error) throw productsResult.error;

      const userData = usersResult.data || [];
      const productData = productsResult.data || [];

      setUsers(userData);
      const userOpts = userData
        .filter(u => typeof u.name === 'string' && u.name !== null)
        .map(u => ({ 
          label: u.name as string, 
          value: u.id 
        }));
      setUserOptions(userOpts);
      
      setProducts(productData);
      const productOpts = productData.map(p => ({ label: p.name, value: p.id }));
      setProductOptions(productOpts);

    } catch (error: any) {
      console.error("Error fetching dropdown data:", error);
      showError(`Error fetching data: ${error.message}`);
    }
  }, []);

  const fetchMembersWithDues = useCallback(async () => {
    try {
      const { data: salesWithDues, error } = await supabase
        .from('sales')
        .select(`
          id,
          member_id,
          outstanding,
          date,
          payment_status,
          transaction_type,
          users!inner(id, name),
          products(name)
        `)
        .eq('transaction_type', TRANSACTION_TYPES.SALE)
        .in('payment_status', [PAYMENT_STATUSES.PENDING, PAYMENT_STATUSES.PARTIALLY_PAID])
        .gt('outstanding', 0);

      if (error) throw error;

      const memberDuesMap = new Map<string, MemberWithDues>();
      
      (salesWithDues || []).forEach(sale => {
        const memberId = sale.member_id;
        const memberName = (sale.users && typeof sale.users === 'object' && 'name' in sale.users)
          ? (sale.users as { name?: string }).name || 'Unknown'
          : 'Unknown';
        
        if (!memberDuesMap.has(memberId)) {
          memberDuesMap.set(memberId, {
            userId: memberId,
            userName: memberName,
            totalDue: 0,
            pendingSales: []
          });
        }
        
        const memberData = memberDuesMap.get(memberId)!;
        memberData.totalDue += sale.outstanding;
        memberData.pendingSales.push({
          productName: sale.products?.name || 'Unknown Product',
          outstanding: sale.outstanding,
          date: sale.date,
          saleId: sale.id
        });
      });

      setMembersWithDues(Array.from(memberDuesMap.values()));
    } catch (error: any) {
      console.error('Error fetching members with dues:', error);
      showError(`Error fetching member dues: ${error.message}`);
    }
  }, []);

  // --- EFFECTS ---
  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  useEffect(() => {
    fetchDropdownData();
  }, [fetchDropdownData]);
  
  useEffect(() => {
    fetchMembersWithDues();
  }, [fetchMembersWithDues, sales]);

  useEffect(() => {
    let observer: MutationObserver | null = null;
    
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });
    
    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, []);

  // --- CRUD OPERATIONS ---
  const processSelectiveClearance = async (memberId: string, selectedProducts: typeof selectedProductsForClearance) => {
    const updatedRecords: any[] = [];
    let totalProcessed = 0;
    
    for (const [saleId, selection] of Object.entries(selectedProducts)) {
      if (!selection.selected || selection.amountToClear <= 0) continue;
      
      const sale = sales.find(s => s.id === saleId);
      if (!sale) {
        console.warn(`Sale with ID ${saleId} not found`);
        continue;
      }
      
      const paymentToApply = Math.min(selection.amountToClear, sale.outstanding);
      if (paymentToApply <= 0) continue;
      
      const newPaid = sale.paid + paymentToApply;
      const newOutstanding = sale.total - newPaid;
      
      let newStatus: PaymentStatus;
      if (newOutstanding <= 0) {
        newStatus = PAYMENT_STATUSES.DUE_CLEARED;
      } else if (newPaid > 0) {
        newStatus = PAYMENT_STATUSES.PARTIALLY_PAID;
      } else {
        newStatus = PAYMENT_STATUSES.PENDING;
      }
      
      const { error: updateError } = await supabase
        .from('sales')
        .update({
          paid: newPaid,
          outstanding: newOutstanding,
          payment_status: newStatus
        })
        .eq('id', saleId);
      
      if (updateError) throw updateError;
      
      updatedRecords.push({
        id: saleId,
        oldPaid: sale.paid,
        newPaid: newPaid,
        oldOutstanding: sale.outstanding,
        newOutstanding: newOutstanding,
        oldStatus: sale.payment_status,
        newStatus: newStatus,
        paymentApplied: paymentToApply,
        productName: sale.products?.name || 'Unknown'
      });
      
      totalProcessed += paymentToApply;
    }
    
    return { updatedRecords, totalProcessed };
  };

  const handleAddNew = async () => {
    const transactionType = newSale.transaction_type || TRANSACTION_TYPES.SALE;
    
    // Validate input
    const validationErrors = validateSaleInput(newSale);
    if (validationErrors.length > 0) {
      showError(validationErrors.join(', '));
      return;
    }

    if (transactionType === TRANSACTION_TYPES.CLEARANCE) {
      const memberWithDues = membersWithDues.find(m => m.userId === newSale.member_id);
      if (!memberWithDues || memberWithDues.totalDue <= 0) {
        showError('Selected member has no outstanding dues to clear.');
        return;
      }

      const selectedProducts = Object.entries(selectedProductsForClearance)
        .filter(([_, selection]) => selection.selected && selection.amountToClear > 0);
      
      if (selectedProducts.length === 0) {
        showError('Please select at least one product to clear.');
        return;
      }

      const totalSelectedAmount = selectedProducts.reduce(
        (sum, [_, selection]) => sum + selection.amountToClear, 0
      );

      if (totalSelectedAmount > memberWithDues.totalDue) {
        showError(`Total clearance amount (₹${totalSelectedAmount.toFixed(2)}) cannot exceed member's total due balance (₹${memberWithDues.totalDue.toFixed(2)})`);
        return;
      }
    }

    const user = users.find(u => u.id === newSale.member_id);
    if (!user) {
      showError('Selected user not found');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let recordToInsert: any;
      let userBalanceChange = 0;
      let oldUserBalance = 0;
      let updatedSalesRecords: any[] = [];

      if (transactionType === TRANSACTION_TYPES.SALE) {
        const qty = validateNumberInput(newSale.qty, 'Quantity');
        const price = validateNumberInput(newSale.price, 'Price');
        const total = qty * price;
        const paid = validateNumberInput(newSale.paid ?? 0, 'Paid amount');
        const outstanding = total - paid;
        
        userBalanceChange = outstanding;
        oldUserBalance = await updateUserBalance(newSale.member_id!, userBalanceChange);

        const payment_status = calculatePaymentStatus(transactionType, total, paid, 0);

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
      } else {
        const { updatedRecords, totalProcessed } = await processSelectiveClearance(
          newSale.member_id!, 
          selectedProductsForClearance
        );
        
        updatedSalesRecords = updatedRecords;
        const paid = totalProcessed;
        
        userBalanceChange = -paid;
        oldUserBalance = await updateUserBalance(newSale.member_id!, userBalanceChange);

        const currentUserBalance = user.due_balance || 0;
        const payment_status = calculatePaymentStatus(transactionType, 0, paid, currentUserBalance);

        recordToInsert = {
          date: String(newSale.date),
          member_id: String(newSale.member_id),
          product_id: null,
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
        .from('sales')
        .insert([recordToInsert])
        .select('*, users(*), products(*)');
      
      if (error) {
        // Rollback changes
        await updateUserBalance(newSale.member_id!, -userBalanceChange);
        if (updatedSalesRecords.length > 0) {
          // Revert sales record changes
          for (const record of updatedSalesRecords) {
            await supabase
              .from('sales')
              .update({
                paid: record.oldPaid,
                outstanding: record.oldOutstanding,
                payment_status: record.oldStatus
              })
              .eq('id', record.id);
          }
        }
        throw error;
      }

      if (data && data.length > 0) {
        const rawRecord = data[0];
        const addedRecord: Sale = {
          id: rawRecord.id,
          date: rawRecord.date,
          qty: rawRecord.qty || 0,
          price: rawRecord.price || 0,
          total: rawRecord.total,
          paid: rawRecord.paid,
          outstanding: rawRecord.outstanding,
          payment_status: isValidPaymentStatus(rawRecord.payment_status) ? rawRecord.payment_status : PAYMENT_STATUSES.PENDING,
          member_id: rawRecord.member_id,
          product_id: rawRecord.product_id || '',
          transaction_type: isValidTransactionType(rawRecord.transaction_type) ? rawRecord.transaction_type : TRANSACTION_TYPES.SALE,
          users: (rawRecord.users && typeof rawRecord.users === 'object') ? rawRecord.users : null,
          products: (rawRecord.products && typeof rawRecord.products === 'object') ? rawRecord.products : null,
        };

        addToUndoStack({ 
          type: 'add', 
          timestamp: Date.now(), 
          data: { 
            addedRecord,
            userBalanceChanges: [{ userId: newSale.member_id!, oldBalance: oldUserBalance, newBalance: oldUserBalance + userBalanceChange }],
            salesRecordReversals: updatedSalesRecords
          } 
        });

        // Optimistic update
        setSales(prevSales => [addedRecord, ...prevSales]);
        setNewSale({});
        setAddingNew(false);
        setSelectedProductsForClearance({});
        
        // Refresh data
        await Promise.all([fetchSales(), fetchDropdownData(), fetchMembersWithDues()]);
        
        const successMessage = transactionType === TRANSACTION_TYPES.CLEARANCE 
          ? `Clearance applied successfully! Updated ${updatedSalesRecords.length} sales record(s). Total amount cleared: ₹${recordToInsert.paid.toFixed(2)}`
          : `Sale record added successfully!`;
        
        // Use a proper toast notification instead of alert in real app
        alert(successMessage);
      }
    } catch (error: any) {
      console.error('Transaction failed:', error);
      showError(`Transaction failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditChange = async (id: string, field: keyof Sale, value: any) => {
    const originalSale = sales.find(sale => sale.id === id);
    if (!originalSale) return;

    // Prevent editing of Clearance records except for specific fields
    if (originalSale.transaction_type === TRANSACTION_TYPES.CLEARANCE && 
        !['date', 'member_id', 'paid'].includes(field)) {
      showError('Clearance records can only have date, member, or paid amount edited.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let updatePayload: { [key: string]: any } = { [field]: value };
      let updatedRecordForUI = { ...originalSale, [field]: value };
      let userBalanceChange = 0;
      let oldUserBalance = 0;

      if (originalSale.transaction_type === TRANSACTION_TYPES.SALE) {
        // Handle Sale record edits
        if (field === 'qty') {
          const product = originalSale.products;
          const newQty = validateNumberInput(value, 'Quantity');

          if (product && product.price_ranges && product.price_ranges.length > 0) {
            const priceRange = product.price_ranges.find(range => newQty >= range.min && newQty <= range.max);
            const newPrice = priceRange ? priceRange.price : product.mrp || 0;
            
            updatePayload.price = newPrice;
            updatedRecordForUI.price = newPrice;
          }
        }

        const qty = Number(updatedRecordForUI.qty);
        const price = Number(updatedRecordForUI.price);
        const paid = Number(updatedRecordForUI.paid);
        const total = qty * price;
        const outstanding = total - paid;
        const payment_status = calculatePaymentStatus(TRANSACTION_TYPES.SALE, total, paid, 0);
        
        // Calculate balance change for user
        const oldOutstanding = originalSale.outstanding;
        userBalanceChange = outstanding - oldOutstanding;
        
        if (userBalanceChange !== 0) {
          oldUserBalance = await updateUserBalance(originalSale.member_id, userBalanceChange);
        }

        const calculatedFields = { total, outstanding, payment_status };
        
        updatePayload = { 
          ...updatePayload, 
          ...calculatedFields,
          product_id: updatedRecordForUI.product_id,
          member_id: updatedRecordForUI.member_id,
        };
        updatedRecordForUI = { 
          ...updatedRecordForUI, 
          ...calculatedFields, 
        };
      } else {
        // Handle Clearance record edits
        if (field === 'paid') {
          const user = users.find(u => u.id === originalSale.member_id);
          const currentBalance = user?.due_balance || 0;
          const oldPaid = originalSale.paid;
          const newPaid = validateNumberInput(value, 'Paid amount');
          
          const paymentChange = newPaid - oldPaid;
          
          if (currentBalance + paymentChange < 0) {
            throw new Error('Payment amount would exceed user\'s available balance');
          }

          userBalanceChange = -paymentChange;
          if (userBalanceChange !== 0) {
            oldUserBalance = await updateUserBalance(originalSale.member_id, userBalanceChange);
          }

          const payment_status = calculatePaymentStatus(TRANSACTION_TYPES.CLEARANCE, 0, newPaid, currentBalance + paymentChange);
          updatePayload.payment_status = payment_status;
          updatedRecordForUI.payment_status = payment_status;
        }
      }

      addToUndoStack({ 
        type: 'edit', 
        timestamp: Date.now(), 
        data: { 
          recordId: id, 
          field, 
          oldValue: originalSale[field], 
          record: originalSale,
          userBalanceChanges: userBalanceChange !== 0 ? 
            [{ userId: originalSale.member_id, oldBalance: oldUserBalance, newBalance: oldUserBalance + userBalanceChange }] : 
            undefined
        } 
      });
      
      // Optimistic update
      setSales(prevSales => prevSales.map(s => s.id === id ? updatedRecordForUI : s));
      setEditingCell(null);

      const { error } = await supabase.from('sales').update(updatePayload).eq('id', id);
      if (error) {
        console.error('Update failed:', error.message);
        // Revert user balance if update fails
        if (userBalanceChange !== 0) {
          await updateUserBalance(originalSale.member_id, -userBalanceChange);
        }
        // Revert optimistic update
        setSales(prevSales => prevSales.map(s => s.id === id ? originalSale : s));
        throw error;
      } else {
        // Refresh data to ensure consistency
        await Promise.all([fetchDropdownData(), fetchMembersWithDues()]);
      }
    } catch (error: any) {
      console.error('Edit failed:', error.message);
      showError(`Edit failed: ${error.message}`);
      // Ensure we revert the optimistic update on any error
      setSales(prevSales => prevSales.map(s => s.id === id ? originalSale : s));
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSelectedRows = async () => {
    if (selectedRows.length === 0) return;
    
    if (!window.confirm(`Delete ${selectedRows.length} record(s)? This action cannot be undone.`)) {
      return;
    }

    const deletedRecords = sales.filter((s) => selectedRows.includes(s.id));
    
    setIsLoading(true);
    setError(null);

    try {
      const userBalanceChanges: { userId: string; oldBalance: number; newBalance: number }[] = [];
      const salesRecordReversals: any[] = [];
      
      for (const record of deletedRecords) {
        let balanceChange = 0;
        
        if (record.transaction_type === TRANSACTION_TYPES.SALE) {
          balanceChange = -record.outstanding; // Decrease user's due balance
        } else {
          // Clearance - need to reverse the clearance
          balanceChange = record.paid; // Increase user's due balance (reverse the clearance)
          
          // Find which sales records were affected by this clearance and reverse them
          const { data: userSales, error } = await supabase
            .from('sales')
            .select('*')
            .eq('member_id', record.member_id)
            .eq('transaction_type', TRANSACTION_TYPES.SALE)
            .order('date', { ascending: true });
          
          if (!error && userSales) {
            let remainingAmount = record.paid;
            for (const sale of userSales) {
              if (remainingAmount <= 0) break;
              if (sale.paid > 0) {
                const paymentToReverse = Math.min(remainingAmount, sale.paid);
                const newPaid = sale.paid - paymentToReverse;
                const newOutstanding = sale.total - newPaid;
                let newStatus: PaymentStatus;
                
                if (newPaid >= sale.total) {
                  newStatus = PAYMENT_STATUSES.FULLY_PAID;
                } else if (newPaid > 0) {
                  newStatus = PAYMENT_STATUSES.PARTIALLY_PAID;
                } else {
                  newStatus = PAYMENT_STATUSES.PENDING;
                }
                
                salesRecordReversals.push({
                  id: sale.id,
                  oldPaid: sale.paid,
                  newPaid: newPaid,
                  oldOutstanding: sale.outstanding,
                  newOutstanding: newOutstanding,
                  oldStatus: sale.payment_status,
                  newStatus: newStatus
                });
                
                remainingAmount -= paymentToReverse;
              }
            }
          }
        }
        
        if (balanceChange !== 0) {
          const oldBalance = await updateUserBalance(record.member_id, balanceChange);
          userBalanceChanges.push({ 
            userId: record.member_id, 
            oldBalance, 
            newBalance: oldBalance + balanceChange 
          });
        }
      }

      // Apply sales record reversals
      for (const reversal of salesRecordReversals) {
        await supabase
          .from('sales')
          .update({
            paid: reversal.newPaid,
            outstanding: reversal.newOutstanding,
            payment_status: reversal.newStatus
          })
          .eq('id', reversal.id);
      }

      addToUndoStack({ 
        type: 'delete', 
        timestamp: Date.now(), 
        data: { 
          deletedRecords,
          userBalanceChanges,
          salesRecordReversals
        } 
      });

      const { error } = await supabase.from('sales').delete().in('id', selectedRows);
      if (error) {
        // Revert all changes if delete fails
        for (const change of userBalanceChanges) {
          await updateUserBalance(change.userId, change.oldBalance - change.newBalance);
        }
        for (const reversal of salesRecordReversals) {
          await supabase
            .from('sales')
            .update({
              paid: reversal.oldPaid,
              outstanding: reversal.oldOutstanding,
              payment_status: reversal.oldStatus
            })
            .eq('id', reversal.id);
        }
        throw error;
      } else {
        // Optimistic update
        setSales(prevSales => prevSales.filter((s) => !selectedRows.includes(s.id)));
        setSelectedRows([]);
        
        // Refresh all data
        await Promise.all([fetchSales(), fetchDropdownData(), fetchMembersWithDues()]);
      }
    } catch (error: any) {
      console.error('Delete failed:', error);
      showError(`Delete failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    
    setIsUndoing(true);
    setIsLoading(true);
    setError(null);
    
    const lastOperation = undoStack[undoStack.length - 1];

    try {
      // Revert user balance changes if any
      if (lastOperation.data.userBalanceChanges) {
        for (const change of lastOperation.data.userBalanceChanges) {
          await supabase
            .from('users')
            .update({ due_balance: change.oldBalance })
            .eq('id', change.userId);
        }
      }

      // Revert sales record reversals if any
      if (lastOperation.data.salesRecordReversals) {
        for (const reversal of lastOperation.data.salesRecordReversals) {
          await supabase
            .from('sales')
            .update({
              paid: reversal.oldPaid,
              outstanding: reversal.oldOutstanding,
              payment_status: reversal.oldStatus
            })
            .eq('id', reversal.id);
        }
      }

      switch (lastOperation.type) {
        case 'delete':
          if (lastOperation.data.deletedRecords) {
            const recordsToRestore = lastOperation.data.deletedRecords.map(({ users, products, ...rec }) => rec);
            await supabase.from('sales').insert(recordsToRestore);
          }
          break;
        case 'add':
          if (lastOperation.data.addedRecord) {
            await supabase.from('sales').delete().eq('id', lastOperation.data.addedRecord.id);
          }
          break;
        case 'edit':
          if (lastOperation.data.originalRecord) {
            const { users, products, ...recordData } = lastOperation.data.originalRecord;
            await supabase.from('sales').update(recordData).eq('id', lastOperation.data.originalRecord.id);
          }
          break;
        case 'import':
          if (lastOperation.data.importedRecords) {
            const idsToDelete = lastOperation.data.importedRecords.map(r => r.id);
            await supabase.from('sales').delete().in('id', idsToDelete);
          }
          break;
      }
      
      setUndoStack(prev => prev.slice(0, -1));
      setRedoStack(prev => [lastOperation, ...prev]);
      
      await Promise.all([fetchSales(), fetchDropdownData(), fetchMembersWithDues()]);
    } catch (error: any) {
      console.error('Undo failed:', error);
      showError(`Undo failed: ${error.message}`);
    } finally {
      setIsUndoing(false);
      setIsLoading(false);
    }
  };

  const handleRedo = async () => {
    if (redoStack.length === 0) return;
    
    setIsUndoing(true);
    setIsLoading(true);
    setError(null);
    
    const operationToRedo = redoStack[0];

    try {
      switch (operationToRedo.type) {
        case 'add':
          if (operationToRedo.data.addedRecord) {
            const { users, products, ...recordData } = operationToRedo.data.addedRecord;
            await supabase.from('sales').insert(recordData);
          }
          break;
        case 'delete':
          if (operationToRedo.data.deletedRecords) {
            const idsToDelete = operationToRedo.data.deletedRecords.map(r => r.id);
            await supabase.from('sales').delete().in('id', idsToDelete);
          }
          break;
        case 'edit':
          if (operationToRedo.data.updatedRecord) {
            const { users, products, ...recordData } = operationToRedo.data.updatedRecord;
            await supabase.from('sales').update(recordData).eq('id', operationToRedo.data.updatedRecord.id);
          }
          break;
        case 'import':
          if (operationToRedo.data.importedRecords) {
            const recordsToInsert = operationToRedo.data.importedRecords.map(({ users, products, ...rec }) => rec);
            await supabase.from('sales').insert(recordsToInsert);
          }
          break;
      }

      // Reapply user balance changes
      if (operationToRedo.data.userBalanceChanges) {
        for (const change of operationToRedo.data.userBalanceChanges) {
          await supabase
            .from('users')
            .update({ due_balance: change.newBalance })
            .eq('id', change.userId);
        }
      }

      // Reapply sales record reversals
      if (operationToRedo.data.salesRecordReversals) {
        for (const reversal of operationToRedo.data.salesRecordReversals) {
          await supabase
            .from('sales')
            .update({
              paid: reversal.newPaid,
              outstanding: reversal.newOutstanding,
              payment_status: reversal.newStatus
            })
            .eq('id', reversal.id);
        }
      }

      setRedoStack(prev => prev.slice(1));
      setUndoStack(prev => [...prev, operationToRedo]);

      await Promise.all([fetchSales(), fetchDropdownData(), fetchMembersWithDues()]);
    } catch (error: any) {
      console.error('Redo failed:', error);
      showError(`Redo failed: ${error.message}`);
    } finally {
      setIsUndoing(false);
      setIsLoading(false);
    }
  };

  
  const handleImportedData = async (importedRows: any[]) => {
    if (!importedRows || importedRows.length === 0) {
      showError("No data found in the imported file.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const processedData = importedRows.map(row => {
        const user = users.find(u => u.name === row.member);
        const product = products.find(p => p.name === row.product);
        const transactionType = isValidTransactionType(row.transaction_type) ? row.transaction_type : TRANSACTION_TYPES.SALE;
        
        if (!user) {
          console.warn(`Skipping row due to missing user:`, row);
          return null;
        }

        if (transactionType === TRANSACTION_TYPES.SALE && !product) {
          console.warn(`Skipping Sale row due to missing product:`, row);
          return null;
        }

        if (transactionType === TRANSACTION_TYPES.SALE) {
          const qty = validateNumberInput(row.qty || 0, 'Quantity');
          let price = 0;
          
          if (product!.price_ranges && product!.price_ranges.length > 0) {
            const priceRange = product!.price_ranges.find(r => qty >= r.min && qty <= r.max);
            price = priceRange ? priceRange.price : product!.mrp || 0;
          } else {
            price = product!.mrp || 0;
          }

          const paid = validateNumberInput(row.paid || 0, 'Paid amount');
          const total = qty * price;
          const outstanding = total - paid;
          const payment_status = calculatePaymentStatus(TRANSACTION_TYPES.SALE, total, paid, 0);

          return {
            date: row.date,
            member_id: user.id,
            product_id: product!.id,
            qty,
            price,
            total,
            paid,
            outstanding,
            payment_status,
            transaction_type: TRANSACTION_TYPES.SALE,
          };
        } else {
          const paid = validateNumberInput(row.paid || 0, 'Paid amount');
          const payment_status = calculatePaymentStatus(TRANSACTION_TYPES.CLEARANCE, 0, paid, user.due_balance || 0);

          return {
            date: row.date,
            member_id: user.id,
            product_id: null,
            qty: 0,
            price: 0,
            total: 0,
            paid,
            outstanding: 0,
            payment_status,
            transaction_type: TRANSACTION_TYPES.CLEARANCE,
          };
        }
      }).filter((row): row is NonNullable<typeof row> => row !== null);

      if (processedData.length === 0) {
        throw new Error("No valid rows could be processed from the import. Please check user and product names match exactly.");
      }

      // Calculate and apply user balance changes
      const userBalanceChanges: { userId: string; oldBalance: number; newBalance: number }[] = [];
      
      for (const record of processedData) {
        let balanceChange = 0;
        
        if (record.transaction_type === TRANSACTION_TYPES.SALE) {
          balanceChange = record.outstanding;
        } else {
          balanceChange = -record.paid;
        }
        
        if (balanceChange !== 0) {
          const oldBalance = await updateUserBalance(record.member_id, balanceChange);
          userBalanceChanges.push({ 
            userId: record.member_id, 
            oldBalance, 
            newBalance: oldBalance + balanceChange 
          });
        }
      }

      const { data: newRecords, error } = await supabase.from('sales').insert(processedData).select();

      if (error) {
        // Revert balance changes if insert fails
        for (const change of userBalanceChanges) {
          await updateUserBalance(change.userId, change.oldBalance - change.newBalance);
        }
        throw error;
      }

      if (newRecords) {
        const importedSales: Sale[] = (newRecords as any[]).map(rec => ({
          ...rec,
          payment_status: isValidPaymentStatus(rec.payment_status) ? rec.payment_status : PAYMENT_STATUSES.PENDING,
          transaction_type: isValidTransactionType(rec.transaction_type) ? rec.transaction_type : TRANSACTION_TYPES.SALE,
          users: null,
          products: null,
        }));
        
        addToUndoStack({ 
          type: 'import', 
          timestamp: Date.now(), 
          data: { 
            importedRecords: importedSales,
            userBalanceChanges 
          } 
        });
        
        // Refresh all data
        await Promise.all([fetchSales(), fetchDropdownData(), fetchMembersWithDues()]);
        
        alert(`${newRecords.length} rows imported successfully!`);
      }
    } catch (error: any) {
      console.error('Import failed:', error);
      showError(`Import failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyCustomDate = () => {
    if (customDate?.from && customDate?.to) {
      setDate(customDate);
      setDialogOpen(false);
      setPopoverOpen(false);
    } else {
      showError("Please select both start and end dates.");
    }
  };

  // --- UI HANDLERS & MEMOS ---
  const handleNewChange = useCallback((field: keyof Sale, value: any) => {
    setNewSale(prev => {
      const updated = { ...prev, [field]: value };
      
      // Reset form when transaction type changes
      if (field === 'transaction_type') {
        setSelectedProductsForClearance({});
        return {
          transaction_type: value,
          date: prev.date,
          member_id: prev.member_id,
        };
      }
      
      if (field === 'product_id' && value) {
        const product = products.find(p => p.id === value);
        if (product) {
          updated.price = product.mrp || 0;
        }
      }
      
      return updated;
    });
  }, [products]);

  // Auto-calculate fields for new sale
  useEffect(() => {
    if (newSale.transaction_type === TRANSACTION_TYPES.CLEARANCE) {
      const paid = newSale.paid || 0;
      const user = users.find(u => u.id === newSale.member_id);
      const userBalance = user?.due_balance || 0;
      const payment_status = calculatePaymentStatus(TRANSACTION_TYPES.CLEARANCE, 0, paid, userBalance);
      
      setNewSale(prev => ({ 
        ...prev, 
        qty: 0, 
        price: 0, 
        total: 0, 
        outstanding: 0, 
        product_id: '',
        payment_status 
      }));
    } else {
      const qty = newSale.qty || 0;
      let price = newSale.price || 0;

      if (newSale.product_id && qty > 0) {
        const product = products.find(p => p.id === newSale.product_id);
        if (product && product.price_ranges && product.price_ranges.length > 0) {
          const priceRange = product.price_ranges.find(range => qty >= range.min && qty <= range.max);
          price = priceRange ? priceRange.price : product.mrp || 0;
        } else if (product) {
          price = product.mrp || 0;
        }
      }

      const paid = newSale.paid || 0;
      const total = qty * price;
      const outstanding = total - paid;
      const payment_status = calculatePaymentStatus(TRANSACTION_TYPES.SALE, total, paid, 0);
      
      setNewSale(prev => ({ ...prev, price, total, outstanding, payment_status }));
    }
  }, [newSale.qty, newSale.product_id, newSale.paid, newSale.transaction_type, newSale.member_id, products, users]);

  const getClearanceUserOptions = useMemo(() => {
    if (newSale.transaction_type !== TRANSACTION_TYPES.CLEARANCE) {
      return userOptions;
    }
    
    return membersWithDues.map(member => ({
      label: `${member.userName} (₹${member.totalDue.toFixed(2)} due - ${member.pendingSales.length} pending sales)`,
      value: member.userId
    }));
  }, [newSale.transaction_type, userOptions, membersWithDues]);

  const getPendingSalesForMember = useCallback((memberId: string) => {
    const memberData = membersWithDues.find(m => m.userId === memberId);
    return memberData?.pendingSales || [];
  }, [membersWithDues]);

  const handleProductSelectionForClearance = useCallback((saleId: string, selected: boolean, maxAmount: number) => {
    setSelectedProductsForClearance(prev => {
      const updated = {
        ...prev,
        [saleId]: {
          selected,
          amountToClear: selected ? maxAmount : 0
        }
      };
      
      // Update the paid amount in newSale
      const totalAmountToClear = Object.values(updated)
        .reduce((sum, item) => sum + (item.selected ? item.amountToClear : 0), 0);
      
      setNewSale(prevSale => ({ ...prevSale, paid: totalAmountToClear }));
      
      return updated;
    });
  }, []);

  const sortedSales = useMemo(() => {
    let sortableItems = sales.filter(s => {
      if (!searchTerm) return true;
      const lowerSearch = searchTerm.toLowerCase();
      const userName = s.users?.name || '';
      const productName = s.products?.name || '';
      const transactionType = s.transaction_type || '';
      return (
        userName.toLowerCase().includes(lowerSearch) ||
        productName.toLowerCase().includes(lowerSearch) ||
        transactionType.toLowerCase().includes(lowerSearch)
      );
    });
    
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        const getSortValue = (item: Sale, key: string) => {
          if (key === 'user') return item.users?.name;
          if (key === 'product') return item.products?.name;
          return item[key as keyof Sale];
        };
        
        const valA = getSortValue(a, sortConfig.key!);
        const valB = getSortValue(b, sortConfig.key!);

        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [sales, searchTerm, sortConfig]);


const handleExportToExcel = useCallback(() => {
  const dataToExport = sales.filter(s => {
    if (!searchTerm) return true;
    const lowerSearch = searchTerm.toLowerCase();
    const userName = s.users?.name || '';
    const productName = s.products?.name || '';
    const transactionType = s.transaction_type || '';
    return (
      userName.toLowerCase().includes(lowerSearch) ||
      productName.toLowerCase().includes(lowerSearch) ||
      transactionType.toLowerCase().includes(lowerSearch)
    );
  });

  if (dataToExport.length === 0) {
    showError("No data to export.");
    return;
  }
  
  try {
    const exportData = dataToExport.map(s => ({
      Date: s.date,
      'Transaction Type': s.transaction_type,
      Member: s.users?.name || 'N/A',
      Product: s.products?.name || 'N/A',
      Quantity: s.qty,
      Price: s.price,
      Total: s.total,
      Paid: s.paid,
      Outstanding: s.outstanding,
      'Payment Status': s.payment_status,
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales");
    XLSX.writeFile(workbook, `Sales_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  } catch (error: any) {
    console.error('Export failed:', error);
    showError(`Export failed: ${error.message}`);
  }
}, [sales, searchTerm]); // Use sales and searchTerm instead of sortedSales
  
  const requestSort = useCallback((key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  }, [sortConfig]);

  const handleRowSelect = useCallback((id: string) => {
    setSelectedRows(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedRows.length === sortedSales.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(sortedSales.map(s => s.id));
    }
  }, [selectedRows.length, sortedSales]);
  
  const displayDate = useMemo(() => {
    if (!date?.from) {
      return null;
    }
    const fromMonth = format(date.from, "MMM");
    const fromYear = format(date.from, "yyyy");
    if (date.to && (format(date.from, 'yyyyMM') === format(date.to, 'yyyyMM'))) {
      return `${fromMonth.toUpperCase()} ${fromYear}`;
    }
    if (date.to) {
      const toMonth = format(date.to, "MMM");
      const toYear = format(date.to, "yyyy");
      if (fromYear === toYear) {
        return `${fromMonth.toUpperCase()} - ${toMonth.toUpperCase()} ${fromYear}`;
      }
      return `${fromMonth.toUpperCase()} ${fromYear} - ${toMonth.toUpperCase()} ${toYear}`;
    }
    return `${fromMonth.toUpperCase()} ${fromYear}`;
  }, [date]);

  // --- RENDER HELPERS ---
  const renderEditableCell = (sale: Sale, field: keyof Sale) => {
    const isEditing = editingCell?.rowId === sale.id && editingCell.field === field;
    const isCalculated = ['total', 'outstanding'].includes(field);
    const isReadOnly = sale.transaction_type === TRANSACTION_TYPES.CLEARANCE && 
                      !['date', 'member_id', 'paid', 'payment_status'].includes(field);
    const clickHandler = (isCalculated || isReadOnly) ? undefined : () => setEditingCell({ rowId: sale.id, field });

    if (isEditing) {
      if (field === 'payment_status') {
        const statusOptions = sale.transaction_type === TRANSACTION_TYPES.SALE 
          ? [PAYMENT_STATUSES.FULLY_PAID, PAYMENT_STATUSES.PARTIALLY_PAID, PAYMENT_STATUSES.PENDING, PAYMENT_STATUSES.DUE_CLEARED]
          : [PAYMENT_STATUSES.PARTIAL_CLEARANCE, PAYMENT_STATUSES.COMPLETE_CLEARANCE];
          
        return (
          <TableCell className="p-1">
            <select
              className="w-full p-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-1 focus:ring-blue-500 h-8"
              value={sale.payment_status}
              onChange={(e) => handleEditChange(sale.id, field, e.target.value)}
              onBlur={() => setEditingCell(null)}
              autoFocus
            >
              {statusOptions.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </TableCell>
        );
      }

      if (field === 'member_id' || field === 'product_id') {
        const options = field === 'member_id' ? userOptions : productOptions;
        return (
          <TableCell className="p-1">
            <Select
              options={options}
              defaultValue={options.find(o => o.value === sale[field])}
              onChange={(selected: any) => handleEditChange(sale.id, field, selected?.value)}
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
            type={field === 'date' ? 'date' : 'number'}
            className="h-8"
            defaultValue={sale[field] as any}
            onBlur={(e) => handleEditChange(sale.id, field, e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            autoFocus
          />
        </TableCell>
      );
    }
    
    const displayValue = field === 'member_id' 
      ? sale.users?.name 
      : field === 'product_id' 
      ? sale.products?.name 
      : sale[field];
    
    const isCurrency = ['price', 'total', 'paid', 'outstanding'].includes(field);
    
    if (field === 'payment_status') {
      return (
        <TableCell 
          className={cn("font-semibold", statusColors[sale.payment_status], isReadOnly ? "cursor-default" : "cursor-pointer")} 
          onClick={clickHandler}
        >
          {sale.payment_status}
        </TableCell>
      );
    }

    // Continuing from where the code was cut off...

    if (field === 'transaction_type') {
      return (
        <TableCell>
          <span className={cn("px-2 py-1 rounded-full text-xs font-medium", transactionTypeColors[sale.transaction_type])}>
            {sale.transaction_type}
          </span>
        </TableCell>
      );
    }

    return (
      <TableCell 
        className={cn(isReadOnly ? "cursor-default text-gray-500" : "cursor-pointer", isCurrency && "text-right")} 
        onClick={clickHandler}
      >
        {isCurrency ? formatCurrency(Number(displayValue)) : String(displayValue ?? '')}
      </TableCell>
    );
  };

  const renderProductSelectionDialog = () => {
    if (newSale.transaction_type !== TRANSACTION_TYPES.CLEARANCE || !newSale.member_id) return null;
    
    const pendingSales = sales.filter(s => 
      s.member_id === newSale.member_id && 
      s.transaction_type === TRANSACTION_TYPES.SALE && 
      s.outstanding > 0 &&
      [PAYMENT_STATUSES.PENDING, PAYMENT_STATUSES.PARTIALLY_PAID].includes(s.payment_status)
    );

    if (pendingSales.length === 0) return null;

    return (
      <div className="mt-2 p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
        <h4 className="font-semibold mb-2 text-sm">Select Products to Clear:</h4>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {pendingSales.map(sale => (
            <div key={sale.id} className="flex items-center justify-between p-2 border rounded text-sm">
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={selectedProductsForClearance[sale.id]?.selected || false}
                  onChange={(e) => handleProductSelectionForClearance(
                    sale.id, 
                    e.target.checked, 
                    sale.outstanding
                  )}
                  className="flex-shrink-0"
                />
                <span className="truncate">
                  {sale.products?.name || 'Unknown'} ({new Date(sale.date).toLocaleDateString()})
                </span>
                <span className="text-red-600 font-medium flex-shrink-0">
                  ₹{sale.outstanding.toFixed(2)}
                </span>
              </div>
              {selectedProductsForClearance[sale.id]?.selected && (
                <input
                  type="number"
                  step="0.01"
                  max={sale.outstanding}
                  min="0"
                  value={selectedProductsForClearance[sale.id]?.amountToClear || 0}
                  onChange={(e) => {
                    const amount = Math.min(Number(e.target.value), sale.outstanding);
                    setSelectedProductsForClearance(prev => {
                      const updated = {
                        ...prev,
                        [sale.id]: { selected: true, amountToClear: amount }
                      };
                      
                      // Update total paid amount
                      const totalAmountToClear = Object.values(updated)
                        .reduce((sum, item) => sum + (item.selected ? item.amountToClear : 0), 0);
                      
                      setNewSale(prevSale => ({ ...prevSale, paid: totalAmountToClear }));
                      
                      return updated;
                    });
                  }}
                  className="w-20 px-2 py-1 border rounded text-right ml-2 flex-shrink-0"
                  placeholder="Amount"
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t text-sm font-semibold text-gray-800 dark:text-gray-200">
          Total Selected: ₹{Object.values(selectedProductsForClearance)
            .reduce((sum, item) => sum + (item.selected ? item.amountToClear : 0), 0)
            .toFixed(2)}
        </div>
      </div>
    );
  };

  const renderNewRecordRow = () => {
    const transactionType = newSale.transaction_type || TRANSACTION_TYPES.SALE;
    const selectedMemberPendingSales = newSale.member_id ? getPendingSalesForMember(newSale.member_id) : [];
    
    return (
      <TableRow className="bg-secondary">
        <TableCell></TableCell>
        <TableCell className="p-1">
          <Input 
            type="date" 
            className="h-8" 
            value={newSale.date ?? ''} 
            onChange={(e) => handleNewChange('date' as keyof Sale, e.target.value)} 
          />
        </TableCell>
        <TableCell className="p-1">
          <Select 
            options={transactionTypeOptions}
            value={transactionTypeOptions.find(opt => opt.value === transactionType)}
            onChange={(s: any) => handleNewChange('transaction_type' as keyof Sale, s?.value)}
            styles={getSelectStyles(isDarkMode)}
            placeholder="Select type..."
          />
        </TableCell>
        <TableCell className="p-1 min-w-[200px]">
          <div className="space-y-1">
            <Select 
              options={getClearanceUserOptions} 
              onChange={(s: any) => handleNewChange('member_id' as keyof Sale, s?.value)} 
              styles={getSelectStyles(isDarkMode)} 
              placeholder={transactionType === TRANSACTION_TYPES.CLEARANCE ? "Select member with dues..." : "Select member..."}
              noOptionsMessage={() => transactionType === TRANSACTION_TYPES.CLEARANCE ? 'No members with outstanding dues' : 'No members found'}
            />
            {/* Show pending sales details for clearance transactions */}
            {transactionType === TRANSACTION_TYPES.CLEARANCE && newSale.member_id && selectedMemberPendingSales.length > 0 && (
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded border max-h-32 overflow-y-auto">
                <div className="font-semibold mb-2 text-gray-800 dark:text-gray-200">
                  Pending Sales ({selectedMemberPendingSales.length} items):
                </div>
                <div className="space-y-1">
                  {selectedMemberPendingSales.map((sale, index) => (
                    <div key={index} className="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-600 last:border-b-0">
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
                      ₹{selectedMemberPendingSales.reduce((sum, sale) => sum + sale.outstanding, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TableCell>
        <TableCell className="p-1 min-w-[150px]">
          {transactionType === TRANSACTION_TYPES.SALE ? (
            <Select 
              options={productOptions} 
              onChange={(s: any) => handleNewChange("product_id" as keyof Sale, s?.value || "")} 
              styles={getSelectStyles(isDarkMode)} 
              placeholder="Select product..."
            />
          ) : (
            <div className="space-y-1">
              <div className="text-sm text-gray-500">
                {Object.keys(selectedProductsForClearance).filter(id => selectedProductsForClearance[id].selected).length > 0 
                  ? `${Object.keys(selectedProductsForClearance).filter(id => selectedProductsForClearance[id].selected).length} selected`
                  : 'Select products below'
                }
              </div>
              {renderProductSelectionDialog()}
            </div>
          )}
        </TableCell>
        
        <TableCell className="p-1">
          {transactionType === TRANSACTION_TYPES.SALE ? (
            <Input 
              type="number" 
              className="h-8 w-16 text-right" 
              value={newSale.qty ?? ''} 
              onChange={(e) => handleNewChange('qty' as keyof Sale, Number(e.target.value))} 
            />
          ) : (
            <span className="text-gray-400 text-sm">-</span>
          )}
        </TableCell>
        
        <TableCell className="p-1">
          {transactionType === TRANSACTION_TYPES.SALE ? (
            <Input 
              type="number" 
              step="0.01" 
              className="h-8 w-24 text-right" 
              value={newSale.price ?? ''} 
              onChange={(e) => handleNewChange('price' as keyof Sale, Number(e.target.value))} 
            />
          ) : (
            <span className="text-gray-400 text-sm">₹0.00</span>
          )}
        </TableCell>
        
        <TableCell className="p-1 text-right">
          {transactionType === TRANSACTION_TYPES.SALE ? formatCurrency(newSale.total ?? 0) : '₹0.00'}
        </TableCell>
        
        <TableCell className="p-1">
          <div className="space-y-1">
            <Input 
              type="number" 
              step="0.01" 
              className="h-8 w-24 text-right" 
              value={newSale.paid ?? ''} 
              onChange={(e) => {
                if (transactionType === TRANSACTION_TYPES.SALE) {
                  handleNewChange('paid' as keyof Sale, Number(e.target.value));
                }
                // For clearance, paid amount is calculated from selected products
              }}
              placeholder={transactionType === TRANSACTION_TYPES.CLEARANCE ? 'Auto-calculated' : '0'}
              readOnly={transactionType === TRANSACTION_TYPES.CLEARANCE}
            />
            {transactionType === TRANSACTION_TYPES.CLEARANCE && (
              <div className="text-xs text-gray-500">
                From selected products
              </div>
            )}
          </div>
        </TableCell>
        
        <TableCell className="p-1 text-right">
          {transactionType === TRANSACTION_TYPES.SALE ? formatCurrency(newSale.outstanding ?? 0) : '₹0.00'}
        </TableCell>
        
        <TableCell className="p-1">
          <div className={cn("font-semibold", statusColors[newSale.payment_status || PAYMENT_STATUSES.PENDING])}>
            {newSale.payment_status || PAYMENT_STATUSES.PENDING}
          </div>
        </TableCell>
        
        <TableCell className="p-1 text-right">
          <div className="flex gap-2 justify-end">
            <Button 
              onClick={handleAddNew} 
              size="sm" 
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={
                isLoading ||
                (transactionType === TRANSACTION_TYPES.CLEARANCE && 
                Object.keys(selectedProductsForClearance).filter(id => selectedProductsForClearance[id].selected).length === 0)
              }
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
            <Button 
              onClick={() => { 
                setAddingNew(false); 
                setNewSale({}); 
                setSelectedProductsForClearance({});
              }} 
              variant="ghost" 
              size="sm"
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert className="border-red-200 bg-red-50 text-red-800">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <EnhancedSalesDashboard data={sortedSales} />
      
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <CardTitle className="text-2xl">Transaction Records</CardTitle>
              {displayDate && (
                <div className="flex items-center gap-2 text-muted-foreground border rounded-lg px-3 py-1">
                  <CalendarIcon className="h-4 w-4" />
                  <span className="font-semibold">{displayDate}</span>
                </div>
              )}
            </div>
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
                  setDate({ from: subMonths(new Date(), 6), to: new Date() }); 
                  setPopoverOpen(false); }}
                  >Last 6 Months
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

            <div className="flex items-center gap-2">
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleRedo} variant="outline" size="sm" disabled={redoStack.length === 0 || isUndoing || isLoading}>
                      <Redo className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Redo</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleUndo} variant="outline" size="sm" disabled={undoStack.length === 0 || isUndoing || isLoading}>
                      <Undo className="h-4 w-4"/>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Undo</p></TooltipContent>
                </Tooltip>
                <ExcelImport onDataParsed={handleImportedData} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleExportToExcel} variant="outline" size="sm" disabled={isLoading}>
                      <Upload className="h-4 w-4"/>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Export</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={() => setAddingNew(true)} size="sm" disabled={addingNew || isLoading}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Add new</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px] px-4">
                    <div
                      onClick={handleSelectAll}
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-all",
                        (sortedSales.length > 0 && selectedRows.length === sortedSales.length)
                          ? "bg-indigo-600 border-2 border-indigo-600"
                          : "border-2 border-gray-400 dark:border-gray-500 hover:border-indigo-500"
                      )}
                    >
                      {(selectedRows.length === sortedSales.length && sortedSales.length > 0) && <div className="w-2 h-2 bg-white rounded-full"></div>}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => requestSort('date')} className="cursor-pointer">Date</TableHead>
                  <TableHead onClick={() => requestSort('transaction_type')} className="cursor-pointer">Type</TableHead>
                  <TableHead onClick={() => requestSort('user')} className="cursor-pointer">Member</TableHead>
                  <TableHead onClick={() => requestSort('product')} className="cursor-pointer">Product</TableHead>
                  <TableHead onClick={() => requestSort('qty')} className="text-right cursor-pointer">Qty</TableHead>
                  <TableHead onClick={() => requestSort('price')} className="text-right cursor-pointer">Price</TableHead>
                  <TableHead onClick={() => requestSort('total')} className="text-right cursor-pointer">Total</TableHead>
                  <TableHead onClick={() => requestSort('paid')} className="text-right cursor-pointer">Paid</TableHead>
                  <TableHead onClick={() => requestSort('outstanding')} className="text-right cursor-pointer">Outstanding</TableHead>
                  <TableHead onClick={() => requestSort('payment_status')} className="cursor-pointer">Status</TableHead>
                  <TableHead className="text-right pr-4">
                    <Button variant="ghost" size="icon" onClick={deleteSelectedRows} disabled={selectedRows.length === 0 || isLoading}>
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addingNew && renderNewRecordRow()}
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center h-24">
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        Loading...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : sortedSales.length > 0 ? sortedSales.map((sale) => (
                  <TableRow key={sale.id} data-state={selectedRows.includes(sale.id) ? "selected" : undefined}>
                    <TableCell className="px-4">
                      <div
                        onClick={() => handleRowSelect(sale.id)}
                        className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-all",
                          selectedRows.includes(sale.id)
                            ? "bg-indigo-600 border-2 border-indigo-600"
                            : "border-2 border-gray-400 dark:border-gray-500 hover:border-indigo-500"
                        )}
                      >
                        {selectedRows.includes(sale.id) && <div className="w-2 h-2 bg-white rounded-full"></div>}
                      </div>
                    </TableCell>
                    {renderEditableCell(sale, 'date')}
                    {renderEditableCell(sale, 'transaction_type')}
                    {renderEditableCell(sale, 'member_id')}
                    {renderEditableCell(sale, 'product_id')}
                    {renderEditableCell(sale, 'qty')}
                    {renderEditableCell(sale, 'price')}
                    {renderEditableCell(sale, 'total')}
                    {renderEditableCell(sale, 'paid')}
                    {renderEditableCell(sale, 'outstanding')}
                    {renderEditableCell(sale, 'payment_status')}
                    <TableCell></TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center h-24">
                      No data available for the selected period.
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

export default SalesTable;