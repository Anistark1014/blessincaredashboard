import { useState, useEffect, useMemo } from "react";
import { addDays, format, subMonths, subYears } from "date-fns";
import { DateRange } from "react-day-picker";
import { ArrowDownCircle, ArrowDownSquare, ArrowUpCircle, Calendar as CalendarIcon, Search, Wallet, Upload, Trash2, Plus, Undo, Redo, Copy, DollarSign, TrendingUp, AlertCircle, Activity, PiggyBank, CreditCard, TrendingDown, Target, Users, BarChart3, Calculator, Zap } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import * as XLSX from 'xlsx';
// import EnhancedSalesDashboard from "./EnhancedSalesDashboard";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";

interface Investment {
  id: string;
  investor_name: string;
  amount: number;
  note?: string;
  created_at: string;
}

interface Loan {
  id: string;
  issuer: string;
  amount: number;
  interest_rate: number;
  monthly_payment: number;
  duration_months: number;
  remaining_balance: number;
  status: string;
  created_at: string;
}

interface LoanPayment {
  id: string;
  loan_id: string;
  amount: number;
  note: string | null;
  payment_date: string;
}

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  date: string;
}

interface Product {
  id: string;
  name: string;
  cost_price: number | null;
  mrp: number | null;
}

const Finance = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [balance, setBalance] = useState(0);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanPayments, setLoanPayments] = useState<LoanPayment[]>([]);
  const [investmentPop, setInvestmentPop] = useState(false);
  const [hideKpi, setHideKpi] = useState(true);
  const [loanPop, setLoanPop] = useState(false);
  const [loanAction, setLoanAction] = useState<"take" | "pay">("take");
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(2000, 0, 1),
    to: addDays(new Date(), 0),
  });
  const [isPopoverOpen, setPopoverOpen] = useState(false);

  // Search and sort functionality
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'date' | 'type' | 'description' | 'amount' | 'status'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Export functionality
  const handleExportToExcel = () => {
    if (sales.length === 0 && expenses.length === 0 && investments.length === 0 && loans.length === 0 && loanPayments.length === 0) {
      alert("No data to export.");
      return;
    }
    const exportData = sales.map(s => ({
      Date: s.date,
      'Transaction Type': s.transaction_type,
      Type: s.type || 'N/A',
      Description: s.description || 'N/A',
      Amount: s.amount,
      Note: s.note,
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Finances");
    XLSX.writeFile(workbook, `Finances_Report.xlsx`);
  };

  // Investment form state
  const [investmentForm, setInvestmentForm] = useState({
    investor_name: "",
    amount: "",
    note: "",
  });

  // Loan form state
  const [loanForm, setLoanForm] = useState({
    amount: "",
    issuer: "",
    interest_rate: "",
    monthly_payment: "",
    duration_months: "",
    selected_loan_id: "",
    note: "",
  });

  useEffect(() => {
    fetchData(date);
  }, [date]);

  useEffect(() => {
    fetchSalesData();
    fetchExpensesData();
    fetchProductsData();
  }, [date]);

  // Fetch expenses data filtered by date range
  const fetchExpensesData = async () => {
    if (!date?.from || !date?.to) return;
    const startDate = date.from.toISOString();
    const endDate = date.to.toISOString();
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });
    if (!error && data) {
      setExpenses(data);
    }
  };

  // Fetch products data for COGS calculations
  const fetchProductsData = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, cost_price, mrp")
      .order("name", { ascending: true });
    if (!error && data) {
      setProducts(data);
    }
  };

  // Fetch sales data with products for KPI calculations, filtered by date range
  const fetchSalesData = async () => {
    if (!date?.from || !date?.to) return;
    const startDate = date.from.toISOString();
    const endDate = date.to.toISOString();
    const { data, error } = await supabase
      .from("sales")
      .select("*, products(*)")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });
    if (!error && data) {
      setSales(data);
    }
  };

  const fetchData = async (date: DateRange | undefined) => {
    try {
      // Create proper date ranges that cover full days
      const startDate = date?.from ? new Date(date.from.getFullYear(), date.from.getMonth(), date.from.getDate(), 0, 0, 0, 0).toISOString() : "";
      const endDate = date?.to ? new Date(date.to.getFullYear(), date.to.getMonth(), date.to.getDate(), 23, 59, 59, 999).toISOString() : "";

      // Fetch investments
      const { data: investmentsData, error: investmentsError } = await supabase
        .from("investments")
        .select("*")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false });

      if (investmentsError) throw investmentsError;

      // Fetch loans
      const { data: loansData, error: loansError } = await supabase
        .from("loans")
        .select("*")
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false });

      if (loansError) throw loansError;

      // Fetch loan payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("loan_payments")
        .select("*")
        .gte("payment_date", startDate)
        .lte("payment_date", endDate)
        .order("payment_date", { ascending: false });

      if (paymentsError) throw paymentsError;

      setInvestments(
        (investmentsData || []).map((inv: any) => ({
          id: inv.id,
          investor_name: inv.investor_name,
          amount: inv.amount,
          note: inv.note ?? undefined,
          created_at: inv.created_at,
        }))
      );
      setLoans(
        (loansData || []).map((loan: any) => ({
          id: loan.id,
          issuer: loan.issuer,
          amount: loan.amount,
          interest_rate: loan.interest_rate,
          monthly_payment: loan.monthly_payment,
          duration_months: loan.duration_months,
          remaining_balance: loan.remaining_balance,
          status: loan.status,
          created_at: loan.created_at,
        }))
      );
      setLoanPayments(
        (paymentsData || []).map((payment: any) => ({
          id: payment.id,
          loan_id: payment.loan_id,
          amount: payment.amount,
          note: payment.note ?? null,
          payment_date: payment.payment_date,
        }))
      );

      const turnover = sales.reduce((sum, sale) => sum + Number(sale.total), 0);

      // Calculate balance locally
      const totalInvestments = 0;
      // const totalInvestments = (investmentsData || []).reduce(
      //   (sum, inv) => sum + Number(inv.amount),
      //   0
      // );
      const totalLoans = (loansData || []).reduce(
        (sum, loan) => sum + Number(loan.amount),
        0
      );
      const totalRepayments = (paymentsData || []).reduce(
        (sum, payment) => sum + Number(payment.amount),
        0
      );

      setBalance(totalInvestments + totalLoans - totalRepayments);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch financial data",
        variant: "destructive",
      });
    }
  };
  // Removed unused state variables and functions

  // Combined, filtered, and sorted transactions for display
  const allTransactions = useMemo(() => {
    const transactions = [
      // Sales transactions
      ...sales.map(sale => ({
        id: sale.id,
        originalId: sale.id, // Store original ID
        originalType: 'sales', // Store original table name
        date: new Date(sale.date),
        type: 'Sale',
        description: sale.products?.name || 'Product',
        amount: sale.paid || 0,
        status: sale.payment_status,
        details: `Qty: ${sale.qty} × ₹${sale.price} = ₹${sale.total}`,
        isPositive: true
      })),
      // Expense transactions
      ...expenses.map(expense => ({
        id: expense.id,
        originalId: expense.id, // Store original ID
        originalType: 'expenses', // Store original table name
        date: new Date(expense.date),
        type: 'Expense',
        description: expense.category,
        amount: -expense.amount,
        status: 'Completed',
        details: expense.description || 'No description',
        isPositive: false
      })),
      // Investment transactions
      ...investments.map(investment => ({
        id: investment.id,
        originalId: investment.id, // Store original ID
        originalType: 'investments', // Store original table name
        date: new Date(investment.created_at),
        type: 'Investment',
        description: investment.investor_name,
        amount: investment.amount,
        status: 'Active',
        details: investment.note || 'Investment received',
        isPositive: true
      })),
      // Loan transactions
      ...loans.map(loan => ({
        id: loan.id,
        originalId: loan.id, // Store original ID
        originalType: 'loans', // Store original table name
        date: new Date(loan.created_at),
        type: 'Loan',
        description: loan.issuer,
        amount: loan.amount,
        status: loan.status,
        details: `${loan.duration_months} months @ ${loan.interest_rate}%`,
        isPositive: true
      })),
      // Loan payment transactions
      ...loanPayments.map(payment => ({
        id: payment.id,
        originalId: payment.id, // Store original ID
        originalType: 'loan_payments', // Store original table name
        date: new Date(payment.payment_date),
        type: 'Loan Payment',
        description: 'Loan Payment',
        amount: -payment.amount,
        status: 'Paid',
        details: payment.note || 'Monthly payment',
        isPositive: false
      }))
    ];

    // Filter by search term
    const filteredTransactions = searchTerm.trim() === ''
      ? transactions
      : transactions.filter(transaction =>
        transaction.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.amount.toString().includes(searchTerm) ||
        transaction.date.toLocaleDateString().includes(searchTerm)
      );

    // Sort by selected field and direction
    return filteredTransactions.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortField) {
        case 'date':
          aValue = a.date.getTime();
          bValue = b.date.getTime();
          break;
        case 'type':
          aValue = a.type.toLowerCase();
          bValue = b.type.toLowerCase();
          break;
        case 'description':
          aValue = a.description.toLowerCase();
          bValue = b.description.toLowerCase();
          break;
        case 'amount':
          aValue = Math.abs(a.amount);
          bValue = Math.abs(b.amount);
          break;
        case 'status':
          aValue = a.status.toLowerCase();
          bValue = b.status.toLowerCase();
          break;
        default:
          aValue = a.date.getTime();
          bValue = b.date.getTime();
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  }, [sales, expenses, investments, loans, loanPayments, searchTerm, sortField, sortDirection]);

  // Memo for display date (like SalesTable)
  const displayDate = useMemo(() => {
    if (!date?.from) return null;
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
  }, [date]);



  // Calculate KPIs from sales data (like EnhancedSalesDashboard)
  const salesStats = sales.reduce(
    (acc, sale) => {
      acc.totalSales += Number(sale.total || 0);
      acc.totalPaid += Number(sale.paid || 0);
      acc.gmv += Number(sale.qty || 0) * Number(sale.products?.mrp || 0);
      return acc;
    },
    { totalSales: 0, totalPaid: 0, gmv: 0 }
  );
  const outstanding = salesStats.totalSales - salesStats.totalPaid;
  const revenue = salesStats.totalPaid;
  const gmv = salesStats.gmv;
  const turnover = salesStats.totalSales;
  // const grossProfit = turnover - cogs;
  // const grossProfitMargin = grossProfit / turnover;
  // Calculate total expenses for the period
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  // Calculate COGS (Cost of Goods Sold)
  const cogs = sales.reduce((sum, sale) => {
    const product = sale.products;
    if (product && product.cost_price) {
      return sum + (Number(sale.qty || 0) * Number(product.cost_price));
    }
    return sum;
  }, 0);

  // Calculate new KPIs
  const netProfit = revenue - totalExpenses;
  const grossProfit = revenue - cogs;
  const grossProfitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const netProfitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  // EBITDA calculation (simplified - revenue - expenses excluding interest, taxes, depreciation, amortization)
  // For now, we'll use a simplified version: revenue - operating expenses
  const ebitda = revenue - totalExpenses;
  const ebitdaMargin = revenue > 0 ? (ebitda / revenue) * 100 : 0;

  // PAT calculation (simplified - net profit - taxes)
  const pat = netProfit;
  const patMargin = revenue > 0 ? (pat / revenue) * 100 : 0;

  // Burn Rate calculation (monthly cash outflow)
  // For simplicity, we'll calculate it as (expenses - revenue) / number of months in the period
  const getMonthsInPeriod = () => {
    if (!date?.from || !date?.to) return 1;
    const months = (date.to.getFullYear() - date.from.getFullYear()) * 12 +
      (date.to.getMonth() - date.from.getMonth());
    return Math.max(1, months + 1); // At least 1 month
  };
  const burnRate = (totalExpenses - revenue) / getMonthsInPeriod();

  // Customer LTV calculation (simplified)
  // For now, we'll calculate average revenue per customer
  // const uniqueCustomers = new Set(sales.map(sale => sale.member_id)).size;
  // const customerLTV = uniqueCustomers > 0 ? revenue / uniqueCustomers : 0;

  // Add investments and loans to the company balance
  const totalInvestments = investments.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const outstandingLoans = loans.reduce((sum, loan) => sum + Number(loan.remaining_balance), 0);
  const companyBalance =
    revenue +
    investments.reduce((sum, inv) => sum + Number(inv.amount), 0) +
    loans.reduce((sum, loan) => sum + Number(loan.amount), 0);

  const handleInvestmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data, error } = await supabase
        .from("investments")
        .insert([
          {
            investor_name: investmentForm.investor_name,
            amount: Number(investmentForm.amount),
            note: investmentForm.note || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setInvestments((prev) => [
        {
          id: data.id,
          investor_name: data.investor_name,
          amount: data.amount,
          note: data.note ?? undefined,
          created_at: data.created_at,
        },
        ...prev,
      ]);
      setBalance((prev) => prev + Number(investmentForm.amount));

      setInvestmentForm({ investor_name: "", amount: "", note: "" });
      setInvestmentPop(false);

      toast({
        title: "Success",
        description: "Investment added successfully",
      });
    } catch (error) {
      console.error("Error adding investment:", error);
      toast({
        title: "Error",
        description: "Failed to add investment",
        variant: "destructive",
      });
    }
  };

  const handleLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (loanAction === "take") {
        const { data, error } = await supabase
          .from("loans")
          .insert([
            {
              issuer: loanForm.issuer,
              amount: Number(loanForm.amount),
              interest_rate: Number(loanForm.interest_rate),
              monthly_payment: Number(loanForm.monthly_payment),
              duration_months: Number(loanForm.duration_months),
              remaining_balance: Number(loanForm.amount),
            },
          ])
          .select()
          .single();

        if (error) throw error;

        setLoans((prev) => [data, ...prev]);
        setBalance((prev) => prev + Number(loanForm.amount));

        toast({
          title: "Success",
          description: "Loan taken successfully",
        });
        setLoanPop(false);
      } else {
        // Pay loan
        const selectedLoan = loans.find(
          (loan) => loan.id === loanForm.selected_loan_id
        );
        if (!selectedLoan) {
          toast({
            title: "Error",
            description: "Please select a loan to pay",
            variant: "destructive",
          });
          return;
        }

        const paymentAmount = Number(loanForm.amount);
        const newRemainingBalance =
          selectedLoan.remaining_balance - paymentAmount;

        // Insert payment record
        const { data: paymentData, error: paymentError } = await supabase
          .from("loan_payments")
          .insert([
            {
              loan_id: selectedLoan.id,
              amount: paymentAmount,
              note: loanForm.note || null,
            },
          ])
          .select()
          .single();

        if (paymentError) throw paymentError;

        // Update loan remaining balance
        const { error: loanError } = await supabase
          .from("loans")
          .update({
            remaining_balance: Math.max(0, newRemainingBalance),
            status: newRemainingBalance <= 0 ? "paid" : "active",
          })
          .eq("id", selectedLoan.id);

        if (loanError) throw loanError;

        setLoanPayments((prev) => [
          {
            ...paymentData,
            note: paymentData.note ?? null,
          },
          ...prev,
        ]);
        setLoans((prev) =>
          prev.map((loan) =>
            loan.id === selectedLoan.id
              ? {
                ...loan,
                remaining_balance: Math.max(0, newRemainingBalance),
                status: newRemainingBalance <= 0 ? "paid" : "active",
              }
              : loan
          )
        );
        setBalance((prev) => prev - paymentAmount);

        toast({
          title: "Success",
          description: "Loan payment recorded successfully",
        });
        setLoanPop(false);
      }

      setLoanForm({
        amount: "",
        issuer: "",
        interest_rate: "",
        monthly_payment: "",
        duration_months: "",
        selected_loan_id: "",
        note: "",
      });
      setLoanPop(false);
    } catch (error) {
      console.error("Error processing loan:", error);
      toast({
        title: "Error",
        description: "Failed to process loan transaction",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTransaction = async (id: string, type: string) => {
    try {
      if (type === 'Sale') {
        const { error } = await supabase.from('sales').delete().eq('id', id);
        if (error) throw error;
        setSales(prev => prev.filter(item => item.id !== id));
        toast({ title: 'Success', description: 'Sale deleted.' });
      } else if (type === 'Expense') {
        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (error) throw error;
        setExpenses(prev => prev.filter(item => item.id !== id));
        toast({ title: 'Success', description: 'Expense deleted.' });
      } else if (type === 'Investment') {
        const { error } = await supabase.from('investments').delete().eq('id', id);
        if (error) throw error;
        setInvestments(prev => prev.filter(item => item.id !== id));
        setBalance(prev => prev - Number(investments.find(inv => inv.id === id)?.amount || 0));
        toast({ title: 'Success', description: 'Investment deleted.' });
      } else if (type === 'Loan') {
        // Delete loan payments first
        const { error: loanPaymentsError } = await supabase.from('loan_payments').delete().eq('loan_id', id);
        if (loanPaymentsError) {
          console.error('Error deleting related loan payments:', loanPaymentsError);
        }
        // Delete loan itself
        const { error } = await supabase.from('loans').delete().eq('id', id);
        if (error) throw error;
        setLoans(prev => prev.filter(item => item.id !== id));
        setLoanPayments(prev => prev.filter(payment => payment.loan_id !== id));
        setBalance(prev => prev - Number(loans.find(loan => loan.id === id)?.amount || 0));
        toast({ title: 'Success', description: 'Loan and related payments deleted.' });
      } else if (type === 'Loan Payment') {
        const { error } = await supabase.from('loan_payments').delete().eq('id', id);
        if (error) throw error;
        setLoanPayments(prev => prev.filter(item => item.id !== id));
        // Optionally update loan remaining_balance
        const payment = loanPayments.find(p => p.id === id);
        if (payment) {
          const loan = loans.find(l => l.id === payment.loan_id);
          if (loan) {
            const newBalance = loan.remaining_balance + Number(payment.amount);
            await supabase.from('loans').update({ remaining_balance: newBalance }).eq('id', loan.id);
            setLoans(prev => prev.map(l => l.id === loan.id ? { ...l, remaining_balance: newBalance } : l));
            setBalance(prev => prev + Number(payment.amount));
          }
        }
        toast({ title: 'Success', description: 'Loan payment deleted.' });
      } else {
        throw new Error('Unknown transaction type');
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast({
        title: 'Error',
        description: `Failed to delete ${type} record. See console for details.`,
        variant: 'destructive',
      });
    }
  };


  return (
    <div>
      <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="healthcare-card fade-in-up flex flex-col gap-4">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      {/* Title */}
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Finance Management</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage investments, loans, and financial transactions efficiently.
          </p>
        </div>
      </div>
      {/* Calendar & KPI Toggle */}
      <div className="flex items-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end">
        <Popover open={isPopoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "w-full sm:w-[300px] justify-start text-left font-normal",
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
                {/* <Button
                  variant="ghost"
                  className={cn(
                    "justify-start rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-lavender/20 focus:outline-none",
                    date && date.from && date.to &&
                      date.from.getFullYear() === new Date().getFullYear() &&
                      date.from.getMonth() === new Date().getMonth() &&
                      date.from.getDate() === new Date().getDate() &&
                      date.to.getFullYear() === new Date().getFullYear() &&
                      date.to.getMonth() === new Date().getMonth() &&
                      date.to.getDate() === new Date().getDate() &&
                      date.from.getTime() === date.to.getTime()
                      ? "bg-lavender/30" : ""
                  )}
                  onClick={() => {
                    const now = new Date();
                    setDate({
                      from: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                      to: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                    });
                    setPopoverOpen(false);
                  }}
                >
                  Today
                </Button> */}
                <Button
                  variant="ghost"
                  className={cn(
                    "justify-start rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-lavender/20 focus:outline-none",
                    date && date.from && date.to &&
                      date.from.getFullYear() === new Date().getFullYear() &&
                      date.from.getMonth() === new Date().getMonth() &&
                      date.from.getDate() === 1 &&
                      date.to.getFullYear() === new Date().getFullYear() &&
                      date.to.getMonth() === new Date().getMonth() &&
                      date.to.getDate() === new Date().getDate() &&
                      date.from.getTime() !== date.to.getTime()
                      ? "bg-lavender/30" : ""
                  )}
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
                  className={cn(
                    "justify-start rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-lavender/20 focus:outline-none",
                    date && date.from && date.to &&
                      date.from.getFullYear() === new Date().getFullYear() &&
                      date.from.getMonth() === new Date().getMonth() - 1 &&
                      date.to.getFullYear() === new Date().getFullYear() &&
                      date.to.getMonth() === new Date().getMonth() - 1
                      ? "bg-lavender/30" : ""
                  )}
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
                  className={cn(
                    "justify-start rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-lavender/20 focus:outline-none",
                    date && date.from && date.to &&
                      date.from.getFullYear() === new Date().getFullYear() &&
                      date.from.getMonth() === 0 &&
                      date.to.toDateString() === new Date().toDateString()
                      ? "bg-lavender/30" : ""
                  )}
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
                  className={cn(
                    "justify-start rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-lavender/20 focus:outline-none",
                    date && date.from && date.to &&
                      date.from.getFullYear() === 2000 &&
                      date.from.getMonth() === 0
                      ? "bg-lavender/30" : ""
                  )}
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
          {displayDate && (
            <span className="text-muted-foreground text-sm">{displayDate}</span>
          )}
          <button title={hideKpi ? "Show KPI" : "Hide KPI"} onClick={() => setHideKpi(!hideKpi)} className="ml-auto duration-300">{hideKpi ? <ArrowDownCircle className="h-6 w-6 text-foreground hover:text-white duration-300" /> : <ArrowUpCircle className="h-6 w-6 text-foreground hover:text-white duration-300" />}</button>

        </div>

      </div>
        </div>
      </div>

    <div className="space-y-6">


      {/* Basic KPI Cards */}
      <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${hideKpi ? "hidden" : ""}`}>
        {/* 1. Company Balance (Sales Revenue + Investments + Loans) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Company Balance
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{companyBalance.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Sales revenue + investments + loans
            </p>
          </CardContent>
        </Card>
        {/* 2. GMV (Gross Merchandise Value) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">GMV</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{gmv.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Total value at MRP (sales)
            </p>
          </CardContent>
        </Card>
        {/* 3. Turnover (Total Sales) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Turnover</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{turnover.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total sales
            </p>
          </CardContent>
        </Card>
        {/* 4. Revenue (Total Paid from Sales) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{revenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total received from sales
            </p>
          </CardContent>
        </Card>

        {/* Gross Profit/Margin */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Gross Profit / Margin
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex flex-row items-center gap-2">
              <span className={grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                ₹{grossProfit.toLocaleString()}
              </span>
              <p className={`text-xs font-normal ${grossProfitMargin >= 20 ? 'text-green-600' : grossProfitMargin >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                ({grossProfitMargin.toFixed(2)}%)
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Profit after direct costs
            </p>
          </CardContent>
        </Card>
        {/* 2. Net Profit/Margin */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit / Margin %</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex flex-row items-center gap-2">
              <span className={netProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                ₹{netProfit.toLocaleString()}
              </span>
              <p className={`text-xs font-normal ${netProfitMargin >= 15 ? 'text-green-600' : netProfitMargin >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                ({netProfitMargin.toFixed(2)}%)
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Final profit after all costs
            </p>
          </CardContent>
        </Card>
        {/* 3. EBITDA */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">EBITDA / Margin %</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex flex-row items-center gap-2">
              <span className={ebitda >= 0 ? 'text-green-600' : 'text-red-600'}>
                ₹{ebitda.toLocaleString()}
              </span>
              <p className={`text-xs font-normal ${ebitdaMargin >= 20 ? 'text-green-600' : ebitdaMargin >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                ({ebitdaMargin.toFixed(2)}%)
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Core business profitability
            </p>
          </CardContent>
        </Card>
        {/* 4. PAT (Profit After Tax) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">PAT / Margin %</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex flex-row items-center gap-2">
              <span className={pat >= 0 ? 'text-green-600' : 'text-red-600'}>
                ₹{pat.toLocaleString()}
              </span>
              <p className={`text-xs font-normal ${patMargin >= 12 ? 'text-green-600' : patMargin >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                ({patMargin.toFixed(2)}%)
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Profit after all deductions
            </p>
          </CardContent>
        </Card>
        {/* 9. Total Outstanding */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ₹{outstanding.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Money owed by customers
            </p>
          </CardContent>
        </Card>
        {/* 10. Total Loans */}
        <Card className="cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-300 group" onClick={() => setLoanPop(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium transition-colors">Total Loan Outstanding</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground transition-colors" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${outstandingLoans > 0 ? 'text-red-600' : 'text-green-600'} group-hover:animate-bounce-subtle`}>
              ₹{outstandingLoans.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Outstanding loan balance
            </p>
          </CardContent>
        </Card>
        {/* 11. Total Investment */}
        <Card className="cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-300 group" onClick={() => setInvestmentPop(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Investment</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold text-green-600 group-hover:animate-bounce-subtle`}>
              ₹{totalInvestments.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Capital invested in business
            </p>
          </CardContent>
        </Card>
        {/* 12. Burn Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Burn Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${burnRate <= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₹{burnRate.toLocaleString()}/month
            </div>
            <p className="text-xs text-muted-foreground">
              {burnRate <= 0 ? 'Cash-flow positive' : 'Monthly cash outflow'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div> <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <CardTitle className="text-2xl">All Transaction Records</CardTitle>

            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4 mt-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by type, description, status, amount, or date..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* <Popover open={isPopoverOpen} onOpenChange={setPopoverOpen}>
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
            </Popover> */}

            <div className="flex items-center gap-2">
              <TooltipProvider delayDuration={0}>
                {/* <Tooltip>
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
                </Tooltip> */}
                <Button onClick={handleExportToExcel} variant="outline" size="sm">
                  <Upload className="h-4 w-4" />
                </Button>
                {/* <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={() => setAddingNew(true)} size="sm" disabled={addingNew}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Add new</p></TooltipContent>
                </Tooltip> */}
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      if (sortField === 'date') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('date');
                        setSortDirection('desc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Date
                      {sortField === 'date' && (
                        <span className="text-xs">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      if (sortField === 'type') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('type');
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Type
                      {sortField === 'type' && (
                        <span className="text-xs">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      if (sortField === 'description') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('description');
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Description
                      {sortField === 'description' && (
                        <span className="text-xs">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      if (sortField === 'amount') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('amount');
                        setSortDirection('desc');
                      }
                    }}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Amount
                      {sortField === 'amount' && (
                        <span className="text-xs">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      if (sortField === 'status') {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('status');
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {sortField === 'status' && (
                        <span className="text-xs">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="text-center">Actions</TableHead> {/* New TableHead for Actions */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{transaction.date.toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge
                        variant="default"
                        className={
                          transaction.type === 'Sale' ? 'bg-green-100 text-green-800' :
                            transaction.type === 'Expense' ? 'bg-red-100 text-red-800' :
                              transaction.type === 'Investment' ? 'bg-blue-100 text-blue-800' :
                                transaction.type === 'Loan' ? 'bg-purple-100 text-purple-800' :
                                  'bg-orange-100 text-orange-800'
                        }
                      >
                        {transaction.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{transaction.description}</div>
                        <div className="text-sm text-muted-foreground">
                          {transaction.details}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${transaction.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.isPositive ? '+' : ''}₹{Math.abs(transaction.amount).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={transaction.status === 'Fully Paid' || transaction.status === 'Active' || transaction.status === 'Completed' || transaction.status === 'Paid' ? 'default' : 'secondary'}
                        className={
                          transaction.status === 'Fully Paid' || transaction.status === 'Active' || transaction.status === 'Completed' || transaction.status === 'Paid'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }
                      >
                        {transaction.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center"> {/* New TableCell for the delete button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTransaction(transaction.originalId, transaction.type)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {/* Empty state */}
                {allTransactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground"> {/* Adjusted colspan */}
                      No transactions found for the selected date range
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card></div>

      {/* Investment Popup Dialog */}
      <Dialog open={investmentPop} onOpenChange={setInvestmentPop}>
        <DialogContent className="w-[95vw] max-w-[425px] mx-auto p-4 sm:p-6">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <PiggyBank className="w-5 h-5" />
              Add Investment
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvestmentSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="popup_investor_name" className="text-sm font-medium">Investor Name</Label>
              <Input
                id="popup_investor_name"
                value={investmentForm.investor_name}
                onChange={(e) =>
                  setInvestmentForm((prev) => ({
                    ...prev,
                    investor_name: e.target.value,
                  }))
                }
                className="border-lavender/30 focus:border-lavender h-10 sm:h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="popup_investment_amount" className="text-sm font-medium">Amount</Label>
              <Input
                id="popup_investment_amount"
                type="number"
                step="0.01"
                value={investmentForm.amount}
                onChange={(e) =>
                  setInvestmentForm((prev) => ({
                    ...prev,
                    amount: e.target.value,
                  }))
                }
                className="border-lavender/30 focus:border-lavender h-10 sm:h-11"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="popup_investment_note" className="text-sm font-medium">Note</Label>
              <Textarea
                id="popup_investment_note"
                value={investmentForm.note}
                onChange={(e) =>
                  setInvestmentForm((prev) => ({
                    ...prev,
                    note: e.target.value,
                  }))
                }
                placeholder="Optional note about the investment"
                className="border-lavender/30 focus:border-lavender min-h-[80px] sm:min-h-[100px]"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInvestmentPop(false)}
                className="flex-1 h-10 sm:h-11"
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1 btn-healthcare h-10 sm:h-11">
                Add Investment
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Loan Popup Dialog */}
      <Dialog open={loanPop} onOpenChange={setLoanPop}>
        <DialogContent className="w-[95vw] max-w-[425px] mx-auto p-4 sm:p-6">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <CreditCard className="w-5 h-5" />
              Loan Management
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Action</Label>
              <Select
                value={loanAction}
                onValueChange={(value: "take" | "pay") =>
                  setLoanAction(value)
                }
              >
                <SelectTrigger className="border-blush/30 focus:border-blush h-10 sm:h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="take">Take a Loan</SelectItem>
                  <SelectItem value="pay">Pay a Loan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <form onSubmit={handleLoanSubmit} className="space-y-4">
              {loanAction === "take" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="popup_loan_amount" className="text-sm font-medium">Amount</Label>
                    <Input
                      id="popup_loan_amount"
                      type="number"
                      step="0.01"
                      value={loanForm.amount}
                      onChange={(e) =>
                        setLoanForm((prev) => ({
                          ...prev,
                          amount: e.target.value,
                        }))
                      }
                      className="border-blush/30 focus:border-blush h-10 sm:h-11"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="popup_loan_issuer" className="text-sm font-medium">Issuer</Label>
                    <Input
                      id="popup_loan_issuer"
                      value={loanForm.issuer}
                      onChange={(e) =>
                        setLoanForm((prev) => ({
                          ...prev,
                          issuer: e.target.value,
                        }))
                      }
                      className="border-blush/30 focus:border-blush h-10 sm:h-11"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="popup_interest_rate" className="text-sm font-medium">Interest %</Label>
                    <Input
                      id="popup_interest_rate"
                      type="number"
                      step="0.01"
                      value={loanForm.interest_rate}
                      onChange={(e) =>
                        setLoanForm((prev) => ({
                          ...prev,
                          interest_rate: e.target.value,
                        }))
                      }
                      className="border-blush/30 focus:border-blush h-10 sm:h-11"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="popup_duration" className="text-sm font-medium">Duration (months)</Label>
                    <Input
                      id="popup_duration"
                      type="number"
                      value={loanForm.duration_months}
                      onChange={(e) =>
                        setLoanForm((prev) => ({
                          ...prev,
                          duration_months: e.target.value,
                        }))
                      }
                      className="border-blush/30 focus:border-blush h-10 sm:h-11"
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Select Loan/Issuer</Label>
                    <Select
                      value={loanForm.selected_loan_id}
                      onValueChange={(value) =>
                        setLoanForm((prev) => ({
                          ...prev,
                          selected_loan_id: value,
                        }))
                      }
                    >
                      <SelectTrigger className="border-blush/30 focus:border-blush h-10 sm:h-11">
                        <SelectValue placeholder="Select a loan to pay" />
                      </SelectTrigger>
                      <SelectContent>
                        {loans
                          .filter(
                            (loan) =>
                              loan.status === "active" &&
                              loan.remaining_balance > 0
                          )
                          .map((loan) => (
                            <SelectItem key={loan.id} value={loan.id}>
                              {loan.issuer} - ₹
                              {loan.remaining_balance.toLocaleString()}{" "}
                              remaining
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="popup_payment_amount" className="text-sm font-medium">Amount</Label>
                    <Input
                      id="popup_payment_amount"
                      type="number"
                      step="0.01"
                      value={loanForm.amount}
                      onChange={(e) =>
                        setLoanForm((prev) => ({
                          ...prev,
                          amount: e.target.value,
                        }))
                      }
                      className="border-blush/30 focus:border-blush h-10 sm:h-11"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="popup_payment_note" className="text-sm font-medium">Note</Label>
                    <Textarea
                      id="popup_payment_note"
                      value={loanForm.note}
                      onChange={(e) =>
                        setLoanForm((prev) => ({
                          ...prev,
                          note: e.target.value,
                        }))
                      }
                      placeholder="Optional note about the payment"
                      className="border-blush/30 focus:border-blush min-h-[80px] sm:min-h-[100px]"
                    />
                  </div>
                </>
              )}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLoanPop(false)}
                  className="flex-1 h-10 sm:h-11"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 btn-healthcare h-10 sm:h-11">
                  {loanAction === "take" ? "Take Loan" : "Make Payment"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Financial Management Section */}
      {/* <div className="flex flex-col md:flex-row gap-4 items-start md:gap-y-6">
        <div className="w-full md:w-2/3 mx-auto fixed top-[12%] left-1/2 -translate-x-1/2 z-10">
          <Card>
            <CardHeader>
              <CardTitle>Financial Management</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="investment" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-lavender/10">
                  <TabsTrigger
                    value="investment"
                    className="data-[state=active]:bg-lavender flex items-center gap-2"
                  >
                    <PiggyBank className="w-4 h-4" />
                    Manage Investment
                  </TabsTrigger>
                  <TabsTrigger
                    value="loan"
                    className="data-[state=active]:bg-blush flex items-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    Loan / Repayment
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="investment" className="space-y-4">
                  <form onSubmit={handleInvestmentSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="investor_name">Investor Name</Label>
                      <Input
                        id="investor_name"
                        value={investmentForm.investor_name}
                        onChange={(e) =>
                          setInvestmentForm((prev) => ({
                            ...prev,
                            investor_name: e.target.value,
                          }))
                        }
                        className="border-lavender/30 focus:border-lavender"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="investment_amount">Amount</Label>
                      <Input
                        id="investment_amount"
                        type="number"
                        step="0.01"
                        value={investmentForm.amount}
                        onChange={(e) =>
                          setInvestmentForm((prev) => ({
                            ...prev,
                            amount: e.target.value,
                          }))
                        }
                        className="border-lavender/30 focus:border-lavender"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="investment_note">Note</Label>
                      <Textarea
                        id="investment_note"
                        value={investmentForm.note}
                        onChange={(e) =>
                          setInvestmentForm((prev) => ({
                            ...prev,
                            note: e.target.value,
                          }))
                        }
                        placeholder="Optional note about the investment"
                        className="border-lavender/30 focus:border-lavender"
                      />
                    </div>
                    <Button type="submit" className="w-full btn-healthcare">
                      Add Investment
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="loan" className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Action</Label>
                      <Select
                        value={loanAction}
                        onValueChange={(value: "take" | "pay") =>
                          setLoanAction(value)
                        }
                      >
                        <SelectTrigger className="border-blush/30 focus:border-blush">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="take">Take a Loan</SelectItem>
                          <SelectItem value="pay">Pay a Loan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <form onSubmit={handleLoanSubmit} className="space-y-4">
                      {loanAction === "take" ? (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="loan_amount">Amount</Label>
                            <Input
                              id="loan_amount"
                              type="number"
                              step="0.01"
                              value={loanForm.amount}
                              onChange={(e) =>
                                setLoanForm((prev) => ({
                                  ...prev,
                                  amount: e.target.value,
                                }))
                              }
                              className="border-blush/30 focus:border-blush"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="loan_issuer">Issuer</Label>
                            <Input
                              id="loan_issuer"
                              value={loanForm.issuer}
                              onChange={(e) =>
                                setLoanForm((prev) => ({
                                  ...prev,
                                  issuer: e.target.value,
                                }))
                              }
                              className="border-blush/30 focus:border-blush"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="interest_rate">Interest %</Label>
                            <Input
                              id="interest_rate"
                              type="number"
                              step="0.01"
                              value={loanForm.interest_rate}
                              onChange={(e) =>
                                setLoanForm((prev) => ({
                                  ...prev,
                                  interest_rate: e.target.value,
                                }))
                              }
                              className="border-blush/30 focus:border-blush"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="duration">Duration (months)</Label>
                            <Input
                              id="duration"
                              type="number"
                              value={loanForm.duration_months}
                              onChange={(e) =>
                                setLoanForm((prev) => ({
                                  ...prev,
                                  duration_months: e.target.value,
                                }))
                              }
                              className="border-blush/30 focus:border-blush"
                              required
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label>Select Loan/Issuer</Label>
                            <Select
                              value={loanForm.selected_loan_id}
                              onValueChange={(value) =>
                                setLoanForm((prev) => ({
                                  ...prev,
                                  selected_loan_id: value,
                                }))
                              }
                            >
                              <SelectTrigger className="border-blush/30 focus:border-blush">
                                <SelectValue placeholder="Select a loan to pay" />
                              </SelectTrigger>
                              <SelectContent>
                                {loans
                                  .filter(
                                    (loan) =>
                                      loan.status === "active" &&
                                      loan.remaining_balance > 0
                                  )
                                  .map((loan) => (
                                    <SelectItem key={loan.id} value={loan.id}>
                                      {loan.issuer} - ₹
                                      {loan.remaining_balance.toLocaleString()}{" "}
                                      remaining
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="payment_amount">Amount</Label>
                            <Input
                              id="payment_amount"
                              type="number"
                              step="0.01"
                              value={loanForm.amount}
                              onChange={(e) =>
                                setLoanForm((prev) => ({
                                  ...prev,
                                  amount: e.target.value,
                                }))
                              }
                              className="border-blush/30 focus:border-blush"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="payment_note">Note</Label>
                            <Textarea
                              id="payment_note"
                              value={loanForm.note}
                              onChange={(e) =>
                                setLoanForm((prev) => ({
                                  ...prev,
                                  note: e.target.value,
                                }))
                              }
                              placeholder="Optional note about the payment"
                              className="border-blush/30 focus:border-blush"
                            />
                          </div>
                        </>
                      )}
                      <Button type="submit" className="w-full btn-healthcare">
                        {loanAction === "take" ? "Take Loan" : "Make Payment"}
                      </Button>
                    </form>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div> */}

      {/* Investments Table */}
      {/* Investments Table */}
    </div>
    </div>
  );
}

export default Finance;
