"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";

import { useToast } from "@/hooks/use-toast";
import { format, subMonths, subYears, addDays } from "date-fns";
import { DateRange } from "react-day-picker";
import * as XLSX from "xlsx";
import ExcelImportExpenses from "./ExcelImportExpenses";
import ExpenseKPICards from "./ExpensesKpi"; // Import the separated KPI component
import {ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

// UI & Icons
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Search,
  Trash2,
  Plus,
  Upload,
  Undo,
  Calendar as CalendarIcon,
} from "lucide-react";
import ReactSelect from "react-select";
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
  Warehouse,
  AlertTriangle,
  Package,
  TrendingUp,
  TrendingDown,
  SortAsc,
  SortDesc,
  Box,
} from "lucide-react";

// --- INTERFACES & CONSTANTS ---
interface Expense {
  id: string;
  type: string;
  category: string;
  amount: number;
  date: string;
  description: string | null;
  inventory_transaction_id: string | null;
}

interface UndoOperation {
  type: "delete" | "add" | "edit" | "import";
  data: {
    deletedRecords?: Expense[];
    addedRecord?: Expense;
    originalRecord?: Expense;
    importedRecords?: Expense[];
  };
}
//To Add Expense Category
const expenseCategories = [
  "Stock Purchase",
  "Marketing",
  "Salaries",
  "Utilities & Subscriptions",
  "Logistics",
  "Travel Allowance",
  "Tax Expense",
  "Other Business Expense",
];

// --- HELPER FUNCTIONS ---
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    amount
  );

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
    color: isDark ? "#F9FAFB" : "#111827",
  }),
  singleValue: (provided: any) => ({
    ...provided,
    color: isDark ? "#F9FAFB" : "#111827",
  }),
  placeholder: (provided: any) => ({
    ...provided,
    color: isDark ? "#9CA3AF" : "#6B7280",
  }),
});

// --- MAIN COMPONENT ---
const AdminExpenses: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingNew, setAddingNew] = useState(false);
  const [newExpense, setNewExpense] = useState<Partial<Omit<Expense, "id">>>({
    date: format(new Date(), "yyyy-MM-dd"),
    amount: 0,
    category: "",
    description: "",
  });
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    field: keyof Expense;
  } | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  // Monthly filtering state
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [isCustomRange, setIsCustomRange] = useState<boolean>(false);
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
  });
  const [undoStack, setUndoStack] = useState<UndoOperation[]>([]);
  const [isUndoing, setIsUndoing] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Expense | null;
    direction: "ascending" | "descending";
  }>({ key: "date", direction: "descending" });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { toast } = useToast();
  const [isPopoverOpen, setPopoverOpen] = useState(false);
  const [hideKpi, setHideKpi] = useState(true);

  // --- DATA FETCHING & SIDE EFFECTS ---

  const fetchExpenses = async () => {
    setLoading(true);
    
    let query = supabase
      .from("expenses")
      .select(
        "id, date, category, description, amount, type, inventory_transaction_id"
      );

    // Apply date filtering based on current mode
    if (!isCustomRange && selectedYear && selectedMonth !== undefined) {
      // Monthly filtering
      const startDate = new Date(selectedYear, selectedMonth, 1).toISOString().slice(0, 10);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0).toISOString().slice(0, 10);
      query = query.gte("date", startDate).lte("date", endDate);
    } else if (isCustomRange && date?.from && date?.to) {
      // Custom range filtering
      const startDate = date.from.toISOString().slice(0, 10);
      const endDate = date.to.toISOString().slice(0, 10);
      query = query.gte("date", startDate).lte("date", endDate);
    }

    const { data, error } = await query.order("date", { ascending: false });
    
    if (error) {
      console.error("Supabase fetch error:", error);
      toast({
        title: "Error",
        description: `Failed to fetch expenses: ${error.message}`,
        variant: "destructive",
      });
    } else {
      // Normalize date field to YYYY-MM-DD for all loaded expenses
      setExpenses(
        (data as Expense[]).map((exp) => ({
          ...exp,
          date: exp.date ? exp.date.slice(0, 10) : "",
        }))
      );
    }
    setLoading(false);
  };


  // Real-time refresh for expenses, sales, inventory, and products
  useEffect(() => {
    fetchExpenses();

    const handleRelevantChange = () => {
      fetchExpenses();
    };

    // Subscribe to expenses changes
    const expensesChannel = supabase
      .channel('expenses-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, handleRelevantChange)
      .subscribe();

    // Subscribe to sales changes
    const salesChannel = supabase
      .channel('sales-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, handleRelevantChange)
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
      supabase.removeChannel(expensesChannel);
      supabase.removeChannel(salesChannel);
      supabase.removeChannel(inventoryChannel);
      supabase.removeChannel(productsChannel);
    };
  }, [selectedYear, selectedMonth, isCustomRange, date]);

  // Command palette event listeners
  useEffect(() => {
    const handleAddExpenseModal = () => {
      setAddingNew(true);
    };

    const handleImportExpense = () => {
      const importBtn = document.querySelector('[data-command-import-btn]') as HTMLElement;
      if (importBtn) {
        importBtn.click();
      }
    };

    const handleExportExpense = () => {
      handleExportToExcel();
    };

    window.addEventListener('open-add-expense-modal', handleAddExpenseModal);
    window.addEventListener('open-import-expense', handleImportExpense);
    window.addEventListener('open-export-expense', handleExportExpense);

    return () => {
      window.removeEventListener('open-add-expense-modal', handleAddExpenseModal);
      window.removeEventListener('open-import-expense', handleImportExpense);
      window.removeEventListener('open-export-expense', handleExportExpense);
    };
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

  // --- DATA PROCESSING (FILTERING & SORTING) ---
  const sortedExpenses = useMemo(() => {
    let filtered = expenses.filter((exp) => {
      const lowerSearch = searchTerm.toLowerCase();
      return (
        (exp.description || "").toLowerCase().includes(lowerSearch) ||
        (exp.category || "").toLowerCase().includes(lowerSearch)
      );
    });
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let valA = a[sortConfig.key!];
        let valB = b[sortConfig.key!];
        // Handle nulls for string and number fields
        if (valA == null) valA = "";
        if (valB == null) valB = "";
        if (valA < valB) return sortConfig.direction === "ascending" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "ascending" ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [expenses, searchTerm, sortConfig]);

  // Memo for display date (like Sales page)
  const displayDate = useMemo(() => {
    if (isCustomRange && date?.from) {
      const fromMonth = date.from.toLocaleString("default", { month: "short" });
      const fromYear = date.from.getFullYear();
      if (
        date.to &&
        date.from.getFullYear() === date.to.getFullYear() &&
        date.from.getMonth() === date.to.getMonth()
      ) {
        return `${fromMonth.toUpperCase()} ${fromYear}`;
      }
      if (date.to) {
        const toMonth = date.to.toLocaleString("default", { month: "short" });
        const toYear = date.to.getFullYear();
        if (fromYear === toYear) {
          return `${fromMonth.toUpperCase()} - ${toMonth.toUpperCase()} ${fromYear}`;
        }
        return `${fromMonth.toUpperCase()} ${fromYear} - ${toMonth.toUpperCase()} ${toYear}`;
      }
      return `${fromMonth.toUpperCase()} ${fromYear}`;
    } else {
      // Monthly view
      const monthNames = [
        "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
        "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
      ];
      return `${monthNames[selectedMonth]} ${selectedYear}`;
    }
  }, [selectedYear, selectedMonth, isCustomRange, date]);

  // Generate year options for the dropdown
  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear; year >= currentYear - 10; year--) {
      years.push(year);
    }
    return years;
  };

  // Month names for tabs
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  // Handler for month tab change
  const handleMonthChange = (monthIndex: string) => {
    const month = parseInt(monthIndex);
    setSelectedMonth(month);
    setIsCustomRange(false);
    // Update date range for the selected month
    setDate({
      from: new Date(selectedYear, month, 1),
      to: new Date(selectedYear, month + 1, 0),
    });
  };

  // Handler for year change
  const handleYearChange = (year: string) => {
    const newYear = parseInt(year);
    setSelectedYear(newYear);
    setIsCustomRange(false);
    // Update date range for the selected month and new year
    setDate({
      from: new Date(newYear, selectedMonth, 1),
      to: new Date(newYear, selectedMonth + 1, 0),
    });
  };

  // Handler for custom range
  const handleCustomRange = () => {
    setIsCustomRange(true);
  };

  // Handler for back to monthly view
  const handleBackToMonthly = () => {
    setIsCustomRange(false);
    // Reset to current month and year
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonth);
    setDate({
      from: new Date(currentYear, currentMonth, 1),
      to: new Date(currentYear, currentMonth + 1, 0),
    });
  };

  // --- CORE LOGIC HANDLERS (CRUD, UNDO, ETC.) ---
  const addToUndoStack = (operation: UndoOperation) => {
    if (isUndoing) return;
    setUndoStack((prev) => [...prev, operation].slice(-10));
  };

  const handleAddNew = async () => {
    if (
      !newExpense.category ||
      !newExpense.date ||
      Number(newExpense.amount) <= 0
    ) {
      return toast({
        title: "Missing Fields",
        description: "Category, Date, and a valid Amount (> 0) are required.",
        variant: "destructive",
      });
    }

    const recordToInsert: any = {
      date: newExpense.date as string,
      category: newExpense.category as string,
      description: newExpense.description ?? "",
      amount: Number(newExpense.amount),
      type: newExpense.category === "Stock Purchase" ? "stock" : "general",
      // inventory_transaction_id will be set only by Inventory.tsx
    };

    // Create optimistic record
    const tempId = `temp-${Date.now()}`;
    const optimisticRecord = {
      id: tempId,
      ...recordToInsert,
    };

    // Optimistically add to UI
    setExpenses((prev) =>
      [optimisticRecord, ...prev].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
    );
    setNewExpense({
      date: format(new Date(), "yyyy-MM-dd"),
      amount: 0,
      category: "",
      description: "",
    });
    setAddingNew(false);

    try {
      const { data, error } = await supabase
        .from("expenses")
        .insert(recordToInsert)
        .select(
          "id, date, category, description, amount, type, inventory_transaction_id"
        )
        .single();

      if (error) {
        // Revert optimistic update
        setExpenses(prev => prev.filter(e => e.id !== tempId));
        setAddingNew(true);
        setNewExpense({
          date: newExpense.date,
          amount: newExpense.amount,
          category: newExpense.category,
          description: newExpense.description,
        });
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // Replace optimistic record with real data
        const realRecord = {
          ...data,
          description: data.description ?? "",
        };
        setExpenses((prev) =>
          prev.map(e => e.id === tempId ? realRecord : e)
        );

        // If this is a stock purchase, try to parse product and qty from description and update inventory
        if (
          recordToInsert.category === "Stock Purchase" &&
          recordToInsert.description
        ) {
          // Try to extract product name and quantity from description
          const match = recordToInsert.description.match(
            /(\d+) units of ([^@]+) at/
          );
          if (match) {
            const qty = parseInt(match[1]);
            const productName = match[2].trim();
            // Find product by name
            const { data: products, error: prodErr } = await supabase
              .from("products")
              .select("id, inventory")
              .ilike("name", `%${productName}%`);
            if (!prodErr && products && products.length > 0) {
              const product = products[0];
              const newInventory = (product.inventory || 0) + qty;
              await supabase
                .from("products")
                .update({ inventory: newInventory })
                .eq("id", product.id);
            }
          }
        }

        addToUndoStack({
          type: "add",
          data: { addedRecord: realRecord },
        });
        toast({ title: "Success", description: "Expense added." });
      }
    } catch (error: any) {
      // Revert optimistic update
      setExpenses(prev => prev.filter(e => e.id !== tempId));
      toast({
        title: "Error",
        description: "Failed to add expense",
        variant: "destructive",
      });
    }
  };

  const handleEditChange = async (
    id: string,
    field: keyof Expense,
    value: any
  ) => {
    const originalRecord = expenses.find((exp) => exp.id === id);
    if (!originalRecord) return;

    const updatedRecord = { ...originalRecord, [field]: value };
    
    // Optimistically update UI
    setExpenses(expenses.map((exp) => (exp.id === id ? updatedRecord : exp)));
    setEditingCell(null);

    addToUndoStack({ type: "edit", data: { originalRecord } });

    try {
      const { error } = await supabase
        .from("expenses")
        .update({ [field]: value })
        .eq("id", id);
      if (error) {
        // Revert optimistic update
        setExpenses(expenses.map((exp) => (exp.id === id ? originalRecord : exp)));
        toast({
          title: "Update Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      // Revert optimistic update
      setExpenses(expenses.map((exp) => (exp.id === id ? originalRecord : exp)));
      toast({
        title: "Update Failed",
        description: "Failed to update expense",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (selectedRows.length === 0) return;
    const deletedRecords = expenses.filter((exp) =>
      selectedRows.includes(exp.id)
    );
    
    // Optimistically remove from UI
    setExpenses(expenses.filter((exp) => !selectedRows.includes(exp.id)));
    const originalSelectedRows = [...selectedRows];
    setSelectedRows([]);

    addToUndoStack({ type: "delete", data: { deletedRecords } });

    try {
      // For each deleted expense, if it's a stock purchase, revert inventory and delete inventory transaction
      for (const exp of deletedRecords) {
        if (exp.category === "Stock Purchase") {
          if (exp.inventory_transaction_id) {
            // Find the inventory transaction
            const { data: invTrans, error: invTransErr } = await supabase
              .from("inventory_transactions")
              .select("id, product_id, quantity")
              .eq("id", exp.inventory_transaction_id)
              .single();
            if (!invTransErr && invTrans) {
              // Subtract quantity from product inventory
              const { data: product, error: prodErr } = await supabase
                .from("products")
                .select("id, inventory")
                .eq("id", invTrans.product_id)
                .single();
              if (!prodErr && product) {
                const newInventory =
                  (product.inventory || 0) - (invTrans.quantity || 0);
                await supabase
                  .from("products")
                  .update({ inventory: newInventory })
                  .eq("id", product.id);
              }
              // Delete the inventory transaction
              await supabase
                .from("inventory_transactions")
                .delete()
                .eq("id", invTrans.id);
            }
          } else if (exp.description) {
            // Fallback: parse description for product and qty
            const match = exp.description.match(/(\d+) units of ([^@]+) at/);
            if (match) {
              const qty = parseInt(match[1]);
              const productName = match[2].trim();
              // Find product by name
              const { data: products, error: prodErr } = await supabase
                .from("products")
                .select("id, inventory")
                .ilike("name", `%${productName}%`);
              if (!prodErr && products && products.length > 0) {
                const product = products[0];
                const newInventory = (product.inventory || 0) - qty;
                await supabase
                  .from("products")
                  .update({ inventory: newInventory })
                  .eq("id", product.id);
              }
            }
          }
        }
      }

      const { error } = await supabase
        .from("expenses")
        .delete()
        .in("id", originalSelectedRows);

      if (error) {
        // Revert optimistic update
        setExpenses((prev) => [...prev, ...deletedRecords]);
        setSelectedRows(originalSelectedRows);
        toast({
          title: "Delete Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `${deletedRecords.length} expense(s) deleted.`,
        });
      }
    } catch (error: any) {
      // Revert optimistic update
      setExpenses((prev) => [...prev, ...deletedRecords]);
      setSelectedRows(originalSelectedRows);
      toast({
        title: "Delete Failed",
        description: "Failed to delete expenses",
        variant: "destructive",
      });
    }
  };

  const handleImportedData = async (importedRows: any[]) => {
    if (!importedRows || importedRows.length === 0) {
      return toast({
        title: "No Data",
        description: "The imported file is empty or invalid.",
        variant: "destructive",
      });
    }

    const processedData = importedRows
      .map((row, index) => ({
        id: `temp-${Date.now()}-${index}`,
        date: new Date(row.Date).toISOString().split("T")[0],
        category: row.Category,
        description: row.Description,
        amount: Number(row.Amount),
        type: row.Type ?? "general", // default type if not present
        inventory_transaction_id: row.InventoryTransactionId ?? null,
      }))
      .filter((d) => d.category && d.date && !isNaN(d.amount));

    if (processedData.length === 0) {
      return toast({
        title: "Invalid Data",
        description:
          "No valid expense rows found. Check column names and data.",
        variant: "destructive",
      });
    }

    // Optimistically add to UI
    setExpenses(prev => [...processedData, ...prev]);

    try {
      const dbData = processedData.map(({ id, ...rest }) => rest);
      const { data, error } = await supabase
        .from("expenses")
        .insert(dbData)
        .select();
      if (error) {
        // Revert optimistic update
        setExpenses(prev => prev.filter(e => !e.id.toString().startsWith('temp-')));
        toast({
          title: "Import Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        const normalizedData = (data as Expense[]).map((exp) => ({
          ...exp,
          description: exp.description ?? "",
        }));

        // Replace optimistic records with real data
        setExpenses(prev => {
          const withoutOptimistic = prev.filter(e => !e.id.toString().startsWith('temp-'));
          return [...normalizedData, ...withoutOptimistic];
        });

        addToUndoStack({
          type: "import",
          data: { importedRecords: normalizedData },
        });
        toast({
          title: "Success",
          description: `${data.length} expenses imported.`,
        });
      }
    } catch (error: any) {
      // Revert optimistic update
      setExpenses(prev => prev.filter(e => !e.id.toString().startsWith('temp-')));
      toast({
        title: "Import Failed",
        description: "Failed to import expenses",
        variant: "destructive",
      });
    }
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    setIsUndoing(true);
    const lastOp = undoStack.pop()!;

    try {
      switch (lastOp.type) {
        case "add":
          await supabase
            .from("expenses")
            .delete()
            .eq("id", lastOp.data.addedRecord!.id);
          break;
        case "delete":
          await supabase
            .from("expenses")
            .insert(lastOp.data.deletedRecords!.map(({ id, ...rest }) => rest));
          break;
        case "edit":
          await supabase
            .from("expenses")
            .update(lastOp.data.originalRecord!)
            .eq("id", lastOp.data.originalRecord!.id);
          break;
      }
      fetchExpenses();
      toast({ title: "Action Undone" });
    } catch (error: any) {
      toast({
        title: "Undo Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUndoing(false);
    }
  };

  const handleExportToExcel = () => {
    const dataToExport = sortedExpenses.map((e) => ({
      Date: e.date,
      Category: e.category,
      Description: e.description,
      Amount: e.amount,
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");
    XLSX.writeFile(workbook, "Expenses_Report.xlsx");
  };

  // --- UI HANDLERS ---
  const requestSort = (key: keyof Expense) => {
    let direction: "ascending" | "descending" = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const handleSelectAll = (checked: boolean | "indeterminate") => {
    setSelectedRows(checked ? sortedExpenses.map((e) => e.id) : []);
  };

  // --- RENDER LOGIC ---
  const renderEditableCell = (expense: Expense, field: keyof Expense) => {
    const isEditing =
      editingCell?.rowId === expense.id && editingCell.field === field;
    if (isEditing) {
      if (field === "category") {
        return (
          <TableCell className="p-1">
            <ReactSelect
              options={expenseCategories.map((c) => ({ value: c, label: c }))}
              defaultValue={{
                value: expense.category,
                label: expense.category,
              }}
              onChange={(opt: any) =>
                handleEditChange(expense.id, "category", opt.value)
              }
              onBlur={() => setEditingCell(null)}
              autoFocus
              styles={getSelectStyles(isDarkMode)}
            />
          </TableCell>
        );
      }
      return (
        <TableCell className="p-1">
          <Input
            type={
              field === "date" ? "date" : field === "amount" ? "number" : "text"
            }
            defaultValue={expense[field] as any}
            onBlur={(e) =>
              handleEditChange(
                expense.id,
                field,
                field === "amount" ? Number(e.target.value) : e.target.value
              )
            }
            onKeyDown={(e) =>
              e.key === "Enter" && (e.target as HTMLInputElement).blur()
            }
            autoFocus
            className="h-8"
          />
        </TableCell>
      );
    }
    return (
      <TableCell
        onClick={() => setEditingCell({ rowId: expense.id, field })}
        className={cn(
          "cursor-pointer",
          field === "amount" && "text-right font-semibold"
        )}
      >
        {field === "amount"
          ? formatCurrency(Number(expense.amount))
          : String(expense[field] ?? "")}
      </TableCell>
    );
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6 ">
      <div className="healthcare-card fade-in-up flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <TrendingDown className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Expense Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage company expenses, track spending, and analyze financial
              performance.
            </p>
          </div>
        </div>
        {/* Add Expense & KPI Button Here */}
        <div className="flex flex-row gap-2 items-center mt-2 sm:mt-0 w-full sm:w-auto justify-start sm:justify-end">
          <Button
            // variant="solid"
            size="lg"
            // className="min-w-[85%] max-w-[90%] px-4 py-2 text-sm font-semibold"
                // variant="default"
            onClick={() => setAddingNew(true)}
            disabled={addingNew}
                className="min-w-[85%] max-w-[90%] px-4 py-2 text-sm font-semibold"
                variant="default"
              >
                + Add Expense
              </Button>
          {/* <Button
            variant="solid"
            size="lg"
            className="bg-primary text-white rounded-md px-4 py-2"
            onClick={() => setHideKpi(!hideKpi)}
          >
            {hideKpi ? "Expand KPI" : "Collapse KPI"}
          </Button> */}

                    <button
            title={hideKpi ? 'Show KPI & Graph' : 'Hide KPI & Graph'}
           onClick={() => setHideKpi(!hideKpi)}
            className="duration-300 sm:max-w-[20%] flex items-center justify-center rounded-md p-2 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={hideKpi ? 'Show KPI & Graph' : 'Hide KPI & Graph'}
          >
            {hideKpi ? (
              <ArrowDownCircle className="h-6 w-6 text-foreground hover:text-white duration-300" />
            ) : (
              <ArrowUpCircle className="h-6 w-6 text-foreground hover:text-white duration-300" />
            )}
          </button>
        </div>
      </div>
      <div className="space-y-6">
        <TooltipProvider>
          <div className="p-4 md:p-1 space-y-6">
            {/* KPI Section - Now using the separated component */}
            {!hideKpi && (
              <ExpenseKPICards
                expenses={sortedExpenses.map((e) => ({
                  ...e,
                  description: e.description ?? "",
                }))}
              />
            )}

            {/* Main Table Card */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <CardTitle>Expense Records</CardTitle>
                  <div className="flex items-center gap-2">
                                  {/* Display current filter */}
                {displayDate && (
                  <div className="mt-2 text-center">
                    <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
                      {displayDate}
                    </span>
                  </div>
                )}
                  </div>
                </div>
                <div className="flex flex-col md:flex-row items-center gap-2 mt-4">
                  <div className="relative flex-grow w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search expenses..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  {/* Monthly/Custom Range Filter UI */}
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    {!isCustomRange ? (
                      <>
                        {/* Year Dropdown */}
                        <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {generateYearOptions().map((year) => (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {/* Custom Range Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCustomRange}
                          className="flex items-center gap-2"
                        >
                          <CalendarIcon className="h-4 w-4" />
                          Custom Range
                        </Button>
                      </>
                    ) : (
                      <>
                        {/* Custom Date Range Picker */}
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
                                    from: new Date(
                                      now.getFullYear(),
                                      now.getMonth(),
                                      1
                                    ),
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
                                    date?.from
                                      ? date.from.toISOString().slice(0, 10)
                                      : ""
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
                                  value={
                                    date?.to ? date.to.toISOString().slice(0, 10) : ""
                                  }
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
                        {/* Back to Monthly Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleBackToMonthly}
                          className="flex items-center gap-2"
                        >
                          ← Back to Monthly
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {/* Month Tabs - Only show when not in custom range mode */}
                {!isCustomRange && (
                  <div className="mt-4">
                    <Tabs value={selectedMonth.toString()} onValueChange={handleMonthChange}>
                      <TabsList className="grid w-full grid-cols-6 lg:grid-cols-12 bg-muted">
                        {monthNames.map((month, index) => (
                          <TabsTrigger
                            key={index}
                            value={index.toString()}
                            className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                          >
                            {month}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  </div>
                )}

              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox
                            onCheckedChange={(checked) =>
                              handleSelectAll(checked === true)
                            }
                            checked={
                              sortedExpenses.length > 0 &&
                              selectedRows.length === sortedExpenses.length
                            }
                          />
                        </TableHead>
                        <TableHead
                          onClick={() => requestSort("date")}
                          className="cursor-pointer"
                        >
                          Date
                        </TableHead>
                        <TableHead
                          onClick={() => requestSort("category")}
                          className="cursor-pointer"
                        >
                          Category
                        </TableHead>
                        <TableHead
                          onClick={() => requestSort("description")}
                          className="cursor-pointer min-w-[300px] md:w-[400px]"
                        >
                          Description
                        </TableHead>
                        <TableHead
                          onClick={() => requestSort("amount")}
                          className="cursor-pointer text-right"
                        >
                          Amount
                        </TableHead>
                        <TableHead className="w-[50px]">
                          {selectedRows.length > 0 && (
                            <Tooltip delayDuration={0}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={handleDelete}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete selected</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {addingNew && (
                        <TableRow className="bg-muted/50">
                          <TableCell></TableCell>
                          <TableCell className="p-1">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-[140px] justify-start text-left font-normal h-8",
                                    !newExpense.date && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {newExpense.date
                                    ? format(new Date(newExpense.date), "dd MMM yyyy")
                                    : "Pick date"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={newExpense.date ? new Date(newExpense.date) : undefined}
                                  onSelect={(date) => {
                                    setNewExpense((prev) => ({
                                      ...prev,
                                      date: date ? format(date, "yyyy-MM-dd") : undefined,
                                    }));
                                  }}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                          <TableCell className="p-1">
                            <ReactSelect
                              options={expenseCategories.map((c) => ({
                                value: c,
                                label: c,
                              }))}
                              placeholder="Select category..."
                              onChange={(opt: any) =>
                                setNewExpense((prev) => ({
                                  ...prev,
                                  category: opt.value,
                                }))
                              }
                              styles={getSelectStyles(isDarkMode)}
                            />
                          </TableCell>
                          <TableCell className="p-1 ">
                            <Input
                              placeholder="Description"
                              value={newExpense.description || ""}
                              onChange={(e) =>
                                setNewExpense((prev) => ({
                                  ...prev,
                                  description: e.target.value,
                                }))
                              }
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={newExpense.amount || ""}
                              onChange={(e) =>
                                setNewExpense((prev) => ({
                                  ...prev,
                                  amount: Number(e.target.value),
                                }))
                              }
                              className="h-8 text-right"
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                onClick={handleAddNew}
                                className="h-8 px-2"
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setAddingNew(false);
                                  setNewExpense({
                                    date: format(new Date(), "yyyy-MM-dd"),
                                    amount: 0,
                                    category: "",
                                    description: "",
                                  });
                                }}
                                className="h-8 px-2"
                              >
                                Cancel
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      {sortedExpenses.map((expense) => (
                        <TableRow
                          key={expense.id}
                          className={
                            selectedRows.includes(expense.id)
                              ? "bg-muted/50"
                              : ""
                          }
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedRows.includes(expense.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedRows((prev) => [
                                    ...prev,
                                    expense.id,
                                  ]);
                                } else {
                                  setSelectedRows((prev) =>
                                    prev.filter((id) => id !== expense.id)
                                  );
                                }
                              }}
                            />
                          </TableCell>
                          {renderEditableCell(expense, "date")}
                          {renderEditableCell(expense, "category")}
                          {renderEditableCell(expense, "description")}
                          {renderEditableCell(expense, "amount")}
                          <TableCell></TableCell>
                        </TableRow>
                      ))}
                      {sortedExpenses.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center py-8 text-muted-foreground"
                          >
                            No expenses found for the selected period.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default AdminExpenses;
