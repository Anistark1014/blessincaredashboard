import { useEffect, useState, useMemo } from 'react';
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
import { Search, Upload, Trash2, Plus, Undo, Redo, Calendar as CalendarIcon, Copy, Badge } from 'lucide-react';
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
} from "@/components/ui/tooltip"

// --- INTERFACE DEFINITIONS ---

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
  email?: string | null;
  role?: string;
  due_balance?: number; // Add due_balance to track outstanding amounts
}

type TransactionType = 'Sale' | 'Clearance';
type PaymentStatus = "Fully Paid" | "Partially Paid" | "Pending" | "Partial Clearance" | "Complete Clearance" | "Due Cleared";

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
  type: 'delete' | 'add' | 'edit' | 'import' | 'duplicate';
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
    userBalanceChanges?: { userId: string; oldBalance: number; newBalance: number }[];
    updatedSalesRecords?: any[];
    salesRecordReversals?: any[];
  };
}

// --- HELPER FUNCTIONS ---

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);

const statusColors: { [key: string]: string } = {
  'Fully Paid': 'text-green-600 dark:text-green-400',
  'Partially Paid': 'text-yellow-600 dark:text-yellow-400',
  'Pending': 'text-red-600 dark:text-red-400',
  'Partial Clearance': 'text-blue-600 dark:text-blue-400',
  'Complete Clearance': 'text-green-600 dark:text-green-400',
  'Due Cleared': 'text-gray-600 dark:text-gray-400',
};

const transactionTypeColors: { [key: string]: string } = {
  'Sale': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'Clearance': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
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

// --- TRANSACTION TYPE OPTIONS ---
const transactionTypeOptions = [
  { label: 'Sale', value: 'Sale' },
  { label: 'Clearance', value: 'Clearance' }
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
  const [showMoreProducts, setShowMoreProducts] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<UndoOperation[]>([]);
  const [redoStack, setRedoStack] = useState<UndoOperation[]>([]);
  const [isUndoing, setIsUndoing] = useState(false);

  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'ascending' | 'descending' }>({
    key: 'date',
    direction: 'descending',
  });

  const [membersWithDues, setMembersWithDues] = useState<{
    userId: string;
    userName: string;
    totalDue: number;
    pendingSales: { productName: string; outstanding: number; date: string }[]
  }[]>([]);

  const fetchMembersWithDues = async () => {
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
        .eq('transaction_type', 'Sale')
        .in('payment_status', ['Pending', 'Partially Paid'])
        .gt('outstanding', 0);

      if (error) {
        console.error('Error fetching members with dues:', error);
        return;
      }
      const memberDuesMap = new Map();

      salesWithDues?.forEach(sale => {
        const memberId = sale.member_id;
        const memberName = sale.users?.name || 'Unknown';

        if (!memberDuesMap.has(memberId)) {
          memberDuesMap.set(memberId, {
            userId: memberId,
            userName: memberName,
            totalDue: 0,
            pendingSales: []
          });
        }

        const memberData = memberDuesMap.get(memberId);
        memberData.totalDue += sale.outstanding;
        memberData.pendingSales.push({
          productName: sale.products?.name || 'Unknown Product',
          outstanding: sale.outstanding,
          date: sale.date
        });
      });

      setMembersWithDues(Array.from(memberDuesMap.values()));
    } catch (error) {
      console.error('Error fetching members with dues:', error);
    }
  };

  useEffect(() => {
    fetchMembersWithDues();
  }, [sales]);

  const getClearanceUserOptions = useMemo(() => {
    if (newSale.transaction_type !== 'Clearance') {
      return userOptions; // Return all users for non-clearance transactions
    }

    // For clearance transactions, only show members with outstanding dues (without due amounts)
    return membersWithDues.map(member => ({
      label: member.userName, // Removed the due amount display
      value: member.userId
    }));
  }, [newSale.transaction_type, userOptions, membersWithDues]);

  const getPendingSalesForMember = (memberId: string) => {
    const memberData = membersWithDues.find(m => m.userId === memberId);
    return memberData?.pendingSales || [];
  };

  // --- DATA FETCHING ---

  const fetchSales = async () => {
    if (!date?.from || !date?.to) {
      return;
    }

    const startDate = date.from.toISOString();
    const endDate = date.to.toISOString();

    const { data, error } = await supabase
      .from('sales')
      .select('*, users(*), products(*)')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching sales:', error);
      alert(`Error fetching sales: ${error.message}`);
    } else {
      setSales(
        (Array.isArray(data)
          ? data
            .filter((row: any) => row && typeof row === 'object' && row.payment_status !== undefined)
            .map((row: any) => ({
              id: row.id,
              date: row.date,
              qty: row.qty || 0,
              price: row.price || 0,
              total: row.total,
              paid: row.paid,
              outstanding: row.outstanding,
              payment_status: row.payment_status ?? 'Pending',
              member_id: row.member_id,
              product_id: row.product_id || '',
              transaction_type: row.transaction_type || 'Sale', // Default to Sale for existing records
              users: row.users && typeof row.users === 'object' ? row.users : null,
              products: row.products && typeof row.products === 'object' ? row.products : null,
            }))
          : [])
      );
    }
  };

  const fetchDropdownData = async () => {
    try {
      const usersPromise = supabase.from('users').select('id, name, due_balance');
      const productsPromise = supabase.from('products').select('id, name, mrp, price_ranges');

      const [usersResult, productsResult] = await Promise.all([usersPromise, productsPromise]);

      if (usersResult.error) throw usersResult.error;
      if (productsResult.error) throw productsResult.error;

      setUsers(usersResult.data || []);
      const userOpts = (usersResult.data || [])
        .filter(u => u.name)
        .map(u => ({
          label: u.name!,
          value: u.id
        }));
      setUserOptions(userOpts);

      setProducts(productsResult.data || []);
      const productOpts = (productsResult.data || []).map(p => ({ label: p.name, value: p.id }));
      setProductOptions(productOpts);

    } catch (error: any) {
      console.error("Error fetching dropdown data:", error.message);
    }
  };

  // --- NEW HELPER FUNCTIONS FOR TRANSACTION LOGIC ---

  const updateUserBalance = async (userId: string, amountChange: number): Promise<number> => {
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('due_balance')
      .eq('id', userId)
      .single();

    if (fetchError) throw fetchError;

    const oldBalance = currentUser.due_balance || 0;
    const newBalance = oldBalance + amountChange;

    const { error: updateError } = await supabase
      .from('users')
      .update({ due_balance: newBalance })
      .eq('id', userId);

    if (updateError) throw updateError;

    return oldBalance;
  };

  const updatePendingSalesStatus = async (userId: string) => {
    // Check if user's balance is now zero
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('due_balance')
      .eq('id', userId)
      .single();

    if (userError || !user || user.due_balance !== 0) return;

    // Update all pending/partially paid sales to "Due Cleared"
    const { error: updateError } = await supabase
      .from('sales')
      .update({ payment_status: 'Due Cleared' })
      .eq('member_id', userId)
      .in('payment_status', ['Pending', 'Partially Paid']);

    if (updateError) {
      console.error('Error updating pending sales status:', updateError);
    }
  };

  const calculatePaymentStatus = (transactionType: TransactionType, total: number, paid: number, userBalance: number): PaymentStatus => {
    if (transactionType === 'Sale') {
      if (paid >= total) return 'Fully Paid';
      if (paid > 0) return 'Partially Paid';
      return 'Pending';
    } else { // Clearance
      const newBalance = userBalance - paid;
      if (newBalance <= 0) return 'Complete Clearance';
      return 'Partial Clearance';
    }
  };

  useEffect(() => {
    fetchSales();
  }, [date]);

  useEffect(() => {
    fetchDropdownData();
  }, []);

  useEffect(() => {
    const checkDarkMode = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // --- ENHANCED CRUD & FEATURE FUNCTIONS ---
  const addToUndoStack = (operation: UndoOperation) => {
    if (isUndoing) return;
    setUndoStack(prev => [...prev, operation].slice(-10));
    setRedoStack([]);
  };

  const updateSalesRecordsForClearance = async (userId: string, clearanceAmount: number) => {
    // Get all pending/partially paid sales for this user, ordered by date (oldest first)
    const { data: pendingSales, error } = await supabase
      .from('sales')
      .select('*')
      .eq('member_id', userId)
      .eq('transaction_type', 'Sale')
      .in('payment_status', ['Pending', 'Partially Paid'])
      .gt('outstanding', 0)
      .order('date', { ascending: true });

    if (error) throw error;
    if (!pendingSales || pendingSales.length === 0) return [];

    let remainingClearanceAmount = clearanceAmount;
    const updatedRecords: any[] = [];

    for (const sale of pendingSales) {
      if (remainingClearanceAmount <= 0) break;

      const outstandingAmount = sale.outstanding;
      const paymentToApply = Math.min(remainingClearanceAmount, outstandingAmount);

      const newPaid = sale.paid + paymentToApply;
      const newOutstanding = sale.total - newPaid;

      let newStatus: PaymentStatus;
      if (newOutstanding <= 0) {
        newStatus = 'Due Cleared';
      } else if (newPaid > 0) {
        newStatus = 'Partially Paid';
      } else {
        newStatus = 'Pending';
      }

      // Update the sales record
      const { error: updateError } = await supabase
        .from('sales')
        .update({
          paid: newPaid,
          outstanding: newOutstanding,
          payment_status: newStatus
        })
        .eq('id', sale.id);

      if (updateError) throw updateError;

      updatedRecords.push({
        id: sale.id,
        oldPaid: sale.paid,
        newPaid: newPaid,
        oldOutstanding: sale.outstanding,
        newOutstanding: newOutstanding,
        oldStatus: sale.payment_status,
        newStatus: newStatus,
        paymentApplied: paymentToApply
      });

      remainingClearanceAmount -= paymentToApply;
    }

    return updatedRecords;
  };

  const revertSalesRecordsForClearance = async (updatedRecords: any[]) => {
    for (const record of updatedRecords) {
      await supabase
        .from('sales')
        .update({
          paid: record.oldPaid,
          outstanding: record.oldOutstanding,
          payment_status: record.oldStatus
        })
        .eq('id', record.id);
    }
  };

  const handleAddNew = async () => {
    const transactionType = newSale.transaction_type || 'Sale';

    // Enhanced validation for clearance transactions
    if (transactionType === 'Clearance') {
      const requiredFields: (keyof Sale)[] = ['date', 'member_id', 'paid'];
      if (!requiredFields.every(field => newSale[field] != null)) {
        alert(`Please fill all required fields for Clearance: Date, Member, Paid Amount`);
        return;
      }

      // Check if member has outstanding dues
      const memberWithDues = membersWithDues.find(m => m.userId === newSale.member_id);
      if (!memberWithDues || memberWithDues.totalDue <= 0) {
        alert('Selected member has no outstanding dues to clear.');
        return;
      }

      const paidAmount = Number(newSale.paid);
      if (paidAmount > memberWithDues.totalDue) {
        alert(`Payment amount (₹${paidAmount}) cannot exceed member's total due balance (₹${memberWithDues.totalDue})`);
        return;
      }

      if (paidAmount <= 0) {
        alert('Payment amount must be greater than zero.');
        return;
      }
    } else {
      // Original validation for sales
      const requiredFields: (keyof Sale)[] = ['date', 'member_id', 'product_id', 'qty', 'price'];
      if (!requiredFields.every(field => newSale[field] != null)) {
        alert(`Please fill all required fields for Sale: Date, Member, Product, Qty, Price`);
        return;
      }
    }

    const user = users.find(u => u.id === newSale.member_id);
    if (!user) {
      alert('Selected user not found');
      return;
    }

    try {
      let recordToInsert: any;
      let userBalanceChange = 0;
      let oldUserBalance = 0;
      let updatedSalesRecords: any[] = [];

      if (transactionType === 'Sale') {
        const qty = Number(newSale.qty);
        const price = Number(newSale.price);
        const total = qty * price;
        const paid = Number(newSale.paid ?? 0);
        const outstanding = total - paid;

        userBalanceChange = outstanding; // Increase user's due balance by outstanding amount
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
      } else { // Clearance
        const paid = Number(newSale.paid);
        const currentUserBalance = user.due_balance || 0;

        // Double-check against current database balance (in case of concurrent updates)
        if (paid > currentUserBalance) {
          alert(`Payment amount (₹${paid}) cannot exceed user's current due balance (₹${currentUserBalance}). Please refresh and try again.`);
          return;
        }

        // Update sales records first to apply the clearance payment
        updatedSalesRecords = await updateSalesRecordsForClearance(newSale.member_id!, paid);

        userBalanceChange = -paid; // Decrease user's due balance
        oldUserBalance = await updateUserBalance(newSale.member_id!, userBalanceChange);

        const payment_status = calculatePaymentStatus(transactionType, 0, paid, currentUserBalance);

        recordToInsert = {
          date: String(newSale.date),
          member_id: String(newSale.member_id),
          product_id: null, // Clearance records don't have products
          qty: 0,
          price: 0,
          total: 0, // For clearance, total is 0
          paid,
          outstanding: 0, // Outstanding is always 0 for clearance
          payment_status,
          transaction_type: transactionType,
        };
      }

      const { data, error } = await supabase.from('sales').insert([recordToInsert]).select('*, users(*), products(*)');

      if (error) {
        // Revert changes if insert fails
        await updateUserBalance(newSale.member_id!, -userBalanceChange);
        if (updatedSalesRecords.length > 0) {
          await revertSalesRecordsForClearance(updatedSalesRecords);
        }
        alert('Insert failed: ' + error.message);
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
          users: (rawRecord.users && typeof rawRecord.users === 'object') ? {
            id: rawRecord.users.id,
            name: rawRecord.users.name,
            email: rawRecord.users.email,
            role: rawRecord.users.role,
            due_balance: rawRecord.users.due_balance
          } : null,
          products: (rawRecord.products && typeof rawRecord.products === 'object') ? {
            id: rawRecord.products.id,
            name: rawRecord.products.name,
            mrp: rawRecord.products.mrp,
            sku_id: rawRecord.products.sku_id || undefined,
            price_ranges: rawRecord.products.price_ranges
          } : null,
        };

        addToUndoStack({
          type: 'add',
          timestamp: Date.now(),
          data: {
            addedRecord,
            userBalanceChanges: [{ userId: newSale.member_id!, oldBalance: oldUserBalance, newBalance: oldUserBalance + userBalanceChange }],
            updatedSalesRecords: updatedSalesRecords // Track sales record changes for undo
          }
        });

        setSales([addedRecord, ...sales]);
        setNewSale({});
        setAddingNew(false);

        // Refresh all data to show updated records
        fetchSales();
        fetchDropdownData();
        fetchMembersWithDues(); // Refresh the members with dues list

        if (transactionType === 'Clearance' && updatedSalesRecords.length > 0) {
          alert(`Clearance applied successfully! Updated ${updatedSalesRecords.length} sales record(s). Total amount cleared: ₹${Number(newSale.paid).toFixed(2)}`);
        } else if (transactionType === 'Sale') {
          alert(`Sale record added successfully!`);
        }
      }
    } catch (error: any) {
      alert('Transaction failed: ' + error.message);
      console.error('Transaction error:', error);
    }
  };


  const handleEditChange = async (id: string, field: keyof Sale, value: any) => {
    const originalSale = sales.find(sale => sale.id === id);
    if (!originalSale) return;

    // Prevent editing of Clearance records except for date and member
    if (originalSale.transaction_type === 'Clearance' && !['date', 'member_id', 'paid'].includes(field)) {
      alert('Clearance records can only have date, member, or paid amount edited. To make other changes, delete this record and create a new one.');
      return;
    }

    let updatePayload: { [key: string]: any } = { [field]: value };
    let updatedRecordForUI = { ...originalSale, [field]: value };
    let userBalanceChange = 0;
    let oldUserBalance = 0;

    try {
      if (originalSale.transaction_type === 'Sale') {
        // Handle Sale record edits
        if (field === 'qty') {
          const product = originalSale.products;
          const newQty = Number(value);

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
        const payment_status = calculatePaymentStatus('Sale', total, paid, 0);

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
          payment_status: calculatedFields.payment_status
        };
        updatedRecordForUI = {
          ...updatedRecordForUI,
          ...calculatedFields,
          payment_status: calculatedFields.payment_status as PaymentStatus
        };
      } else {
        // Handle Clearance record edits
        if (field === 'paid') {
          const user = users.find(u => u.id === originalSale.member_id);
          const currentBalance = user?.due_balance || 0;
          const oldPaid = originalSale.paid;
          const newPaid = Number(value);

          // Calculate the effective change in payment
          const paymentChange = newPaid - oldPaid;

          if (currentBalance + paymentChange < 0) {
            alert(`Payment amount would exceed user's available balance`);
            return;
          }

          userBalanceChange = -paymentChange; // Opposite of payment change
          if (userBalanceChange !== 0) {
            oldUserBalance = await updateUserBalance(originalSale.member_id, userBalanceChange);
          }

          const payment_status = calculatePaymentStatus('Clearance', 0, newPaid, currentBalance + paymentChange);
          updatePayload.payment_status = payment_status;
          updatedRecordForUI.payment_status = payment_status as PaymentStatus;

          // Check if we need to update pending sales
          await updatePendingSalesStatus(originalSale.member_id);
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

      setSales(sales.map(s => s.id === id ? updatedRecordForUI : s));
      setEditingCell(null);

      const { error } = await supabase.from('sales').update(updatePayload).eq('id', id);
      if (error) {
        console.error('Update failed:', error.message);
        // Revert user balance if update fails
        if (userBalanceChange !== 0) {
          await updateUserBalance(originalSale.member_id, -userBalanceChange);
        }
        setSales(sales);
      } else {
        // Refresh user data to show updated balances
        fetchDropdownData();
      }
    } catch (error: any) {
      console.error('Edit failed:', error.message);
      alert('Edit failed: ' + error.message);
      setSales(sales);
    }
  };

  const deleteSelectedRows = async () => {
    if (selectedRows.length === 0 || !window.confirm(`Delete ${selectedRows.length} record(s)?`)) return;

    const deletedRecords = sales.filter((s) => selectedRows.includes(s.id));

    try {
      // Calculate user balance changes and handle clearance reversals
      const userBalanceChanges: { userId: string; oldBalance: number; newBalance: number }[] = [];
      const salesRecordReversals: any[] = [];

      for (const record of deletedRecords) {
        let balanceChange = 0;

        if (record.transaction_type === 'Sale') {
          balanceChange = -record.outstanding; // Decrease user's due balance
        } else { // Clearance - need to reverse the sales record updates
          balanceChange = record.paid; // Increase user's due balance (reverse the clearance)

          // Find which sales records were affected by this clearance and reverse them
          // This is a simplified version - in production, you'd want to store the linkage
          const { data: userSales, error } = await supabase
            .from('sales')
            .select('*')
            .eq('member_id', record.member_id)
            .eq('transaction_type', 'Sale')
            .order('date', { ascending: true });

          if (!error && userSales) {
            let remainingAmount = record.paid;
            for (const sale of userSales) {
              if (remainingAmount <= 0) break;
              if (sale.paid > 0) {
                const paymentToReverse = Math.min(remainingAmount, sale.paid);
                const newPaid = sale.paid - paymentToReverse;
                const newOutstanding = sale.total - newPaid;
                const newStatus = newPaid >= sale.total ? 'Fully Paid' : (newPaid > 0 ? 'Partially Paid' : 'Pending');

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
        alert('Delete failed: ' + error.message);
      } else {
        setSales(sales.filter((s) => !selectedRows.includes(s.id)));
        setSelectedRows([]);

        // Refresh all data
        fetchSales();
        fetchDropdownData();
      }
    } catch (error: any) {
      alert('Delete failed: ' + error.message);
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
            .from('users')
            .update({ due_balance: change.oldBalance })
            .eq('id', change.userId);
        }
      }

      switch (lastOperation.type) {
        case 'delete':
          if (lastOperation.data.deletedRecords) {
            const recordsToRestore = lastOperation.data.deletedRecords.map(({ users, products, ...rec }) => ({
              ...rec,
              date: new Date(rec.date)
            }));
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
            await supabase.from('sales').update({
              ...recordData,
              date: new Date(recordData.date)
            }).eq('id', lastOperation.data.originalRecord.id);
          }
          break;
        case 'duplicate':
          if (lastOperation.data.duplicatedRecords) {
            const idsToDelete = lastOperation.data.duplicatedRecords.map(r => r.id);
            await supabase.from('sales').delete().in('id', idsToDelete);
          }
          break;
      }

      setUndoStack(prev => prev.slice(0, -1));
      setRedoStack(prev => [lastOperation, ...prev]);
      fetchSales();
      fetchDropdownData(); // Refresh user balances
    } catch (error: any) {
      alert('Undo failed: ' + error.message);
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
        case 'add':
          if (operationToRedo.data.addedRecord) {
            const { users, products, ...recordData } = operationToRedo.data.addedRecord;
            await supabase.from('sales').insert({
              ...recordData,
              date: new Date(recordData.date)
            });
          }
          break;
        case 'delete':
          const idsToDelete = operationToRedo.data.deletedRecords!.map(r => r.id);
          await supabase.from('sales').delete().in('id', idsToDelete);
          break;
        case 'edit':
          if (operationToRedo.data.updatedRecord) {
            const { users, products, ...recordData } = operationToRedo.data.updatedRecord;
            await supabase.from('sales').update({
              ...recordData,
              date: new Date(recordData.date)
            }).eq('id', operationToRedo.data.updatedRecord.id);
          }
          break;
        case 'duplicate':
          if (operationToRedo.data.duplicatedRecords) {
            const recordsToRestore = operationToRedo.data.duplicatedRecords.map(({ users, products, ...rec }) => ({
              ...rec,
              date: new Date(rec.date)
            }));
            await supabase.from('sales').insert(recordsToRestore);
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

      setRedoStack(prev => prev.slice(1));
      setUndoStack(prev => [...prev, operationToRedo]);

      fetchSales();
      fetchDropdownData(); // Refresh user balances
    } catch (error: any) {
      alert('Redo failed: ' + error.message);
    } finally {
      setIsUndoing(false);
    }
  };

  const handleExportToExcel = () => {
    if (sortedSales.length === 0) {
      alert("No data to export.");
      return;
    }
    const exportData = sortedSales.map(s => ({
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
    XLSX.writeFile(workbook, `Sales_Report.xlsx`);
  };

  const handleImportedData = async (importedRows: any[]) => {
    if (!importedRows || importedRows.length === 0) {
      alert("No data found in the imported file.");
      return;
    }

    const processedData = importedRows.map(row => {
      const user = users.find(u => u.name === row.member);
      const product = products.find(p => p.name === row.product);
      const transactionType = row.transaction_type || 'Sale';

      if (!user) {
        console.warn(`Skipping row due to missing user:`, row);
        return null;
      }

      if (transactionType === 'Sale' && !product) {
        console.warn(`Skipping Sale row due to missing product:`, row);
        return null;
      }

      if (transactionType === 'Sale') {
        const qty = Number(row.qty || 0);
        let price = 0;
        if (product!.price_ranges && product!.price_ranges.length > 0) {
          const priceRange = product!.price_ranges.find(r => qty >= r.min && qty <= r.max);
          price = priceRange ? priceRange.price : product!.mrp || 0;
        } else {
          price = product!.mrp || 0;
        }

        const paid = Number(row.paid || 0);
        const total = qty * price;
        const outstanding = total - paid;
        const payment_status = calculatePaymentStatus('Sale', total, paid, 0);

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
          transaction_type: 'Sale',
        };
      } else { // Clearance
        const paid = Number(row.paid || 0);
        const payment_status = calculatePaymentStatus('Clearance', 0, paid, user.due_balance || 0);

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
          transaction_type: 'Clearance',
        };
      }
    }).filter((row): row is {
      date: any;
      member_id: string;
      product_id: string | null;
      qty: number;
      price: number;
      total: number;
      paid: number;
      outstanding: number;
      payment_status: PaymentStatus;
      transaction_type: string;
    } => row !== null);

    if (processedData.length === 0) {
      alert("No valid rows could be processed from the import. Please check user and product names match exactly.");
      return;
    }

    try {
      // Calculate and apply user balance changes
      const userBalanceChanges: { userId: string; oldBalance: number; newBalance: number }[] = [];

      for (const record of processedData) {
        let balanceChange = 0;

        if (record.transaction_type === 'Sale') {
          balanceChange = record.outstanding;
        } else { // Clearance
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

      const { data: newRecords, error } = await supabase.from('sales').insert(
        processedData.map(record => ({
          ...record,
          date: new Date(record.date)
        }))
      ).select();

      if (error) {
        // Revert balance changes if insert fails
        for (const change of userBalanceChanges) {
          await updateUserBalance(change.userId, change.oldBalance - change.newBalance);
        }
        alert(`Import failed: ${error.message}`);
      } else if (newRecords) {
        alert(`${newRecords.length} rows imported successfully!`);

        const importedSales: Sale[] = (newRecords as any[]).map(rec => ({
          ...rec,
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

        fetchSales();
        fetchDropdownData(); // Refresh user balances
      }
    } catch (error: any) {
      alert(`Import failed: ${error.message}`);
    }
  };

  const handleApplyCustomDate = () => {
    setDate(customDate);
    setDialogOpen(false);
    setPopoverOpen(false);
  };

  // --- UI HANDLERS & MEMOS ---
  const handleNewChange = (field: keyof Sale, value: any) => {
    setNewSale(prev => {
      const updated = { ...prev, [field]: value };

      // Reset form when transaction type changes
      if (field === 'transaction_type') {
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
  };

  useEffect(() => {
    if (newSale.transaction_type === 'Clearance') {
      // For clearance, only calculate payment status
      const paid = newSale.paid || 0;
      const user = users.find(u => u.id === newSale.member_id);
      const userBalance = user?.due_balance || 0;
      const payment_status = calculatePaymentStatus('Clearance', 0, paid, userBalance);

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
      // Sale transaction logic
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
      const payment_status = calculatePaymentStatus('Sale', total, paid, 0);

      setNewSale(prev => ({ ...prev, price, total, outstanding, payment_status }));
    }
  }, [newSale.qty, newSale.product_id, newSale.paid, newSale.transaction_type, newSale.member_id, products, users]);

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
        }
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

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleRowSelect = (id: string) => {
    setSelectedRows(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedRows.length === sortedSales.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(sortedSales.map(s => s.id));
    }
  };

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

  // --- RENDER LOGIC ---

  const renderEditableCell = (sale: Sale, field: keyof Sale) => {
    const isEditing = editingCell?.rowId === sale.id && editingCell.field === field;
    const isCalculated = ['total', 'outstanding'].includes(field);
    const isReadOnly = sale.transaction_type === 'Clearance' && !['date', 'member_id', 'paid', 'payment_status'].includes(field);
    const clickHandler = (isCalculated || isReadOnly) ? undefined : () => setEditingCell({ rowId: sale.id, field });

    if (isEditing) {
      if (field === 'payment_status') {
        const statusOptions = sale.transaction_type === 'Sale'
          ? ['Fully Paid', 'Partially Paid', 'Pending', 'Due Cleared']
          : ['Partial Clearance', 'Complete Clearance'];

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
        <TableCell className={cn("font-semibold", statusColors[sale.payment_status], isReadOnly ? "cursor-default" : "cursor-pointer")} onClick={clickHandler}>
          {sale.payment_status}
        </TableCell>
      );
    }

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
      <TableCell className={cn(isReadOnly ? "cursor-default text-gray-500" : "cursor-pointer", isCurrency && "text-right")} onClick={clickHandler}>
        {isCurrency ? formatCurrency(Number(displayValue)) : String(displayValue ?? '')}
      </TableCell>
    );
  };

  const renderProductSection = () => {
    const transactionType = newSale.transaction_type || 'Sale';
    const selectedMemberPendingSales = newSale.member_id ? getPendingSalesForMember(newSale.member_id) : [];

    if (transactionType === 'Sale') {
      return (
        <Select
          options={productOptions}
          onChange={(s: any) => handleNewChange("product_id" as keyof Sale, s?.value || "")}
          styles={getSelectStyles(isDarkMode)}
          placeholder="Select product..."
        />
      );
    } else {
      // For clearance, show the products that have pending amounts
      if (newSale.member_id && selectedMemberPendingSales.length > 0) {
        const maxVisible = 3;
        const isExpanded = showMoreProducts === newSale.member_id;
        const visibleProducts = isExpanded ? selectedMemberPendingSales : selectedMemberPendingSales.slice(0, maxVisible);
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
                    <div key={index} className="text-gray-600 dark:text-gray-400">
                      • {sale.productName}
                    </div>
                  ))}
                  {hasMore && !isExpanded && (
                    <button
                      type="button"
                      onClick={() => setShowMoreProducts(newSale.member_id!)}
                      className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium underline"
                    >
                      Show {selectedMemberPendingSales.length - maxVisible} more...
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
            {newSale.member_id ? 'No pending sales' : 'Select member first'}
          </span>
        );
      }
    }
  };

  const renderNewRecordRow = () => {
    const transactionType = newSale.transaction_type || 'Sale';
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
              placeholder={transactionType === 'Clearance' ? "Select member with dues..." : "Select member..."}
              noOptionsMessage={() => transactionType === 'Clearance' ? 'No members with outstanding dues' : 'No members found'}
            />
            {/* Show pending sales details for clearance transactions */}
            {transactionType === 'Clearance' && newSale.member_id && selectedMemberPendingSales.length > 0 && (
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
          {renderProductSection()}
        </TableCell>
        <TableCell className="p-1">
          {transactionType === 'Sale' ? (
            <Input
              type="number"
              className="h-8 w-16 text-right"
              value={newSale.qty ?? ''}
              onChange={(e) => handleNewChange('qty' as keyof Sale, Number(e.target.value))}
            />
          ) : (
            <span className="text-gray-400 text-sm">0</span>
          )}
        </TableCell>
        <TableCell className="p-1">
          {transactionType === 'Sale' ? (
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
          {transactionType === 'Sale' ? formatCurrency(newSale.total ?? 0) : '₹0.00'}
        </TableCell>
        <TableCell className="p-1">
          <div className="space-y-1">
            <Input
              type="number"
              step="0.01"
              className="h-8 w-24 text-right"
              value={newSale.paid ?? ''}
              onChange={(e) => handleNewChange('paid' as keyof Sale, Number(e.target.value))}
              placeholder={transactionType === 'Clearance' ? 'Amount to clear' : '0'}
              max={transactionType === 'Clearance' && newSale.member_id ?
                membersWithDues.find(m => m.userId === newSale.member_id)?.totalDue : undefined}
            />
            {/* Show maximum clearable amount */}
            {transactionType === 'Clearance' && newSale.member_id && (
              <div className="text-xs text-gray-500">
                Max: ₹{membersWithDues.find(m => m.userId === newSale.member_id)?.totalDue.toFixed(2) || '0.00'}
              </div>
            )}
          </div>
        </TableCell>
        <TableCell className="p-1 text-right">
          {transactionType === 'Sale' ? formatCurrency(newSale.outstanding ?? 0) : '₹0.00'}
        </TableCell>
        <TableCell className="p-1">
          <div className={cn("font-semibold", statusColors[newSale.payment_status || 'Pending'])}>
            {newSale.payment_status || 'Pending'}
          </div>
        </TableCell>
        <TableCell className="p-1 text-right">
          <div className="flex gap-2 justify-end">
            <Button
              onClick={handleAddNew}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={
                transactionType === 'Clearance' &&
                (!newSale.member_id || !newSale.paid ||
                  (membersWithDues.find(m => m.userId === newSale.member_id)?.totalDue || 0) === 0)
              }
            >
              Save
            </Button>
            <Button onClick={() => { setAddingNew(false); setNewSale({}); }} variant="ghost" size="sm">
              Cancel
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const handleSimpleDuplicate = async () => {
    if (selectedRows.length === 0) {
      alert('Please select records to duplicate');
      return;
    }

    const selectedSales = sales.filter(sale => selectedRows.includes(sale.id));

    try {
      const recordsToInsert = [];
      const userBalanceChanges: { userId: string; oldBalance: number; newBalance: number }[] = [];

      for (const sale of selectedSales) {
        if (sale.transaction_type === 'Sale') {
          // For sales, duplicate with today's date and 0 paid amount
          const qty = sale.qty;
          const price = sale.price;
          const total = qty * price;
          const paid = 0; // Default to 0 for duplicated records
          const outstanding = total - paid;
          const payment_status = calculatePaymentStatus('Sale', total, paid, 0);

          // Update user balance
          const userBalanceChange = outstanding;
          if (userBalanceChange !== 0) {
            const oldBalance = await updateUserBalance(sale.member_id, userBalanceChange);
            userBalanceChanges.push({
              userId: sale.member_id,
              oldBalance,
              newBalance: oldBalance + userBalanceChange
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
            transaction_type: 'Sale'
          });
        } else {
          // For clearance, we won't duplicate as it doesn't make business sense
          alert('Clearance records cannot be duplicated. Only Sale records will be duplicated.');
          continue;
        }
      }

      if (recordsToInsert.length === 0) {
        alert('No valid records to duplicate');
        return;
      }

      // Insert all records
      const { data, error } = await supabase
        .from('sales')
        .insert(recordsToInsert.map(record => ({
          ...record,
          date: new Date(record.date)
        })))
        .select('*, users(*), products(*)');

      if (error) {
        // Revert balance changes if insert fails
        for (const change of userBalanceChanges) {
          await updateUserBalance(change.userId, change.oldBalance - change.newBalance);
        }
        alert('Duplication failed: ' + error.message);
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
          users: (rawRecord.users && typeof rawRecord.users === 'object') ? {
            id: rawRecord.users.id,
            name: rawRecord.users.name,
            email: rawRecord.users.email,
            role: rawRecord.users.role,
            due_balance: rawRecord.users.due_balance
          } : null,
          products: (rawRecord.products && typeof rawRecord.products === 'object') ? {
            id: rawRecord.products.id,
            name: rawRecord.products.name,
            mrp: rawRecord.products.mrp,
            sku_id: rawRecord.products.sku_id || undefined,
            price_ranges: rawRecord.products.price_ranges
          } : null,
        }));

        addToUndoStack({
          type: 'duplicate',
          timestamp: Date.now(),
          data: {
            duplicatedRecords,
            userBalanceChanges
          }
        });

        setSales([...duplicatedRecords, ...sales]);
        setSelectedRows([]);

        // Refresh data
        fetchSales();
        fetchDropdownData();
        fetchMembersWithDues();

        alert(`${duplicatedRecords.length} record(s) duplicated successfully with today's date!`);
      }
    } catch (error: any) {
      alert('Duplication failed: ' + error.message);
      console.error('Duplication error:', error);
    }
  };

  return (
    <div className="space-y-6">
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
                      setPopoverOpen(false);
                    }}
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
                    <Button onClick={handleRedo} variant="outline" size="sm" disabled={redoStack.length === 0 || isUndoing}>
                      <Redo className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Redo</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleUndo} variant="outline" size="sm" disabled={undoStack.length === 0 || isUndoing}>
                      <Undo className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Undo</p></TooltipContent>
                </Tooltip>
                <ExcelImport onDataParsed={handleImportedData} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleExportToExcel} variant="outline" size="sm">
                      <Upload className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Export</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={() => setAddingNew(true)} size="sm" disabled={addingNew}>
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
          <div className="relative h-[calc(100vh-300px)]">
            <div className="absolute inset-0 overflow-y-auto">
              <div className="min-w-full">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-[50px] px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSelectAll}
                          className="text-xs font-medium"
                        >
                          {(selectedRows.length === sortedSales.length && sortedSales.length > 0) ? "Deselect All" : "Select All"}
                        </Button>
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
                      <TableHead className="text-right pr-4">
                        <Button variant="ghost" size="icon" onClick={deleteSelectedRows} disabled={selectedRows.length === 0}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {addingNew && renderNewRecordRow()}
                    {sortedSales.length > 0 ? sortedSales.map((sale) => (
                      <TableRow key={sale.id} data-state={selectedRows.includes(sale.id) ? "selected" : undefined}>
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
                            {sortedSales.findIndex(s => s.id === sale.id) + 1}
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
            </div>
            <div className="absolute bottom-0 left-0 right-0 overflow-x-auto border-t bg-background">
              <div className="min-w-full" style={{ width: 'max-content', height: '1px' }}></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesTable;