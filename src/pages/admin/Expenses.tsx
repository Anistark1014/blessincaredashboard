"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { format, subMonths, subYears, addDays } from "date-fns";
import { DateRange } from "react-day-picker";
import * as XLSX from "xlsx";
import ExcelImportExpenses from "./ExcelImportExpenses";
import ExpenseKPICards from "./ExpensesKpi"; // Import the separated KPI component

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
import Select from "react-select";
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
  control: (p: any) => ({
    ...p,
    backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
    borderColor: isDark ? "#4B5563" : "#D1D5DB",
  }),
  menu: (p: any) => ({ ...p, backgroundColor: isDark ? "#1F2937" : "#FFFFFF" }),
  option: (p: any, s: any) => ({
    ...p,
    backgroundColor: s.isSelected
      ? "#3B82F6"
      : s.isFocused
      ? isDark
        ? "#374151"
        : "#F3F4F6"
      : "transparent",
    color: s.isSelected ? "#FFFFFF" : isDark ? "#F9FAFB" : "#111827",
  }),
  singleValue: (p: any) => ({ ...p, color: isDark ? "#F9FAFB" : "#111827" }),
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
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(2000, 0, 1),
    to: addDays(new Date(), 0),
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

  // --- DATA FETCHING & SIDE EFFECTS ---

  const fetchExpenses = async () => {
    setLoading(true);
    // Remove date filter for debugging
    const { data, error } = await supabase
      .from("expenses")
      .select(
        "id, date, category, description, amount, type, inventory_transaction_id"
      );
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

  useEffect(() => {
    fetchExpenses();
  }, [date]);
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

    const { data, error } = await supabase
      .from("expenses")
      .insert(recordToInsert)
      .select(
        "id, date, category, description, amount, type, inventory_transaction_id"
      )
      .single();

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
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
      setExpenses((prev) =>
        [
          {
            ...data,
            description: data.description ?? "",
          },
          ...prev,
        ].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
      );
      addToUndoStack({
        type: "add",
        data: { addedRecord: { ...data, description: data.description ?? "" } },
      });
      setNewExpense({
        date: format(new Date(), "yyyy-MM-dd"),
        amount: 0,
        category: "",
        description: "",
      });
      setAddingNew(false);
      toast({ title: "Success", description: "Expense added." });
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
    setExpenses(expenses.map((exp) => (exp.id === id ? updatedRecord : exp)));
    setEditingCell(null);

    addToUndoStack({ type: "edit", data: { originalRecord } });

    const { error } = await supabase
      .from("expenses")
      .update({ [field]: value })
      .eq("id", id);
    if (error) {
      setExpenses(expenses);
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (selectedRows.length === 0) return;
    const deletedRecords = expenses.filter((exp) =>
      selectedRows.includes(exp.id)
    );
    addToUndoStack({ type: "delete", data: { deletedRecords } });

    setExpenses(expenses.filter((exp) => !selectedRows.includes(exp.id)));

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
      .in("id", selectedRows);

    if (error) {
      setExpenses((prev) => [...prev, ...deletedRecords]);
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
      setSelectedRows([]);
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
      .map((row) => ({
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

    const { data, error } = await supabase
      .from("expenses")
      .insert(processedData)
      .select();
    if (error) {
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
      addToUndoStack({
        type: "import",
        data: { importedRecords: normalizedData },
      });
      fetchExpenses();
      toast({
        title: "Success",
        description: `${data.length} expenses imported.`,
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
            <Select
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
      </div>
      <div className="space-y-6">
        <TooltipProvider>
          <div className="p-4 md:p-1 space-y-6">
            {/* KPI Section - Now using the separated component */}
            <ExpenseKPICards
              expenses={sortedExpenses.map((e) => ({
                ...e,
                description: e.description ?? "",
              }))}
            />

            {/* Main Table Card */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <CardTitle>Expense Records</CardTitle>
                  <div className="flex items-center gap-2">
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={handleUndo}
                          variant="outline"
                          size="icon"
                          disabled={undoStack.length === 0}
                        >
                          <Undo className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Undo</p>
                      </TooltipContent>
                    </Tooltip>
                    <ExcelImportExpenses onDataParsed={handleImportedData} />
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={handleExportToExcel}
                          variant="outline"
                          size="icon"
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Export</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          onClick={() => setAddingNew(true)}
                          disabled={addingNew}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Add new</p>
                      </TooltipContent>
                    </Tooltip>
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
                </div>
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
                            <Input
                              type="date"
                              value={
                                newExpense.date ||
                                format(new Date(), "yyyy-MM-dd")
                              }
                              onChange={(e) =>
                                setNewExpense((prev) => ({
                                  ...prev,
                                  date: e.target.value,
                                }))
                              }
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Select
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
