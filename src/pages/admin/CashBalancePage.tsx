import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient'; // Using your real Supabase client
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Plus,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  BarChart3,
  Search,
  X,
  AlertCircle
} from 'lucide-react';

// Real Cash Balance Hook - Connected to your actual Supabase
const useCashBalance = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // A robust date parser to avoid timezone issues with 'YYYY-MM-DD' strings
  const parseDateUTC = (dateString) => {
    if (!dateString) return null;
    // Handles both 'YYYY-MM-DD' and full ISO strings
    const date = new Date(dateString);
    // Check if the date is valid
    if (isNaN(date.getTime())) {
        // Try parsing 'YYYY-MM-DD' manually for robustness
        const parts = dateString.split('-');
        if (parts.length === 3) {
            return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
        }
        return null;
    }
    return date;
  };

  const fetchCashBalance = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching real-time cash balance data...');
      
      const [
        { data: salesData, error: salesError },
        { data: investmentsData, error: investmentsError },
        { data: expensesData, error: expensesError },
        { data: loanPaymentsData, error: loanPaymentsError },
        { data: cashTransactionsData, error: cashError },
        { data: goodsPurchasesData, error: goodsError }
      ] = await Promise.all([
        supabase.from('sales').select('paid, date, payment_status, id'),
        supabase.from('investments').select('amount, created_at, investor_name, id'),
        supabase.from('expenses').select('amount, date, category, description, id'),
        supabase.from('loan_payments').select('amount, payment_date, id'),
        supabase.from('cash_transactions').select('transaction_type, amount, transaction_date, description, id'),
        supabase.from('goods_purchases').select('amount, purchase_date, payment_status, supplier_name, description, id').eq('payment_status', 'paid')
      ]);

      // --- DIAGNOSTIC LOGGING FOR SALES REVENUE ---
      console.log('Sales Data from Supabase:', salesData);
      if (salesError) {
          console.error('Supabase Sales Error:', salesError);
          throw new Error(`Sales data error: ${salesError.message}`);
      }
      // --- END DIAGNOSTIC LOGGING ---

      if (investmentsError) throw new Error(`Investments data error: ${investmentsError.message}`);
      if (expensesError) throw new Error(`Expenses data error: ${expensesError.message}`);
      if (loanPaymentsError) throw new Error(`Loan payments error: ${loanPaymentsError.message}`);
      if (cashError) throw new Error(`Cash transactions error: ${cashError.message}`);
      if (goodsError) throw new Error(`Goods purchases error: ${goodsError.message}`);

      const salesRevenue = salesData?.reduce((sum, sale) => sum + (parseFloat(sale.paid) || 0), 0) || 0;
      const investmentsReceived = investmentsData?.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0) || 0;
      const expensesPaid = expensesData?.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0) || 0;
      const loanRepayments = loanPaymentsData?.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0) || 0;
      const goodsPurchases = goodsPurchasesData?.reduce((sum, purchase) => sum + (parseFloat(purchase.amount) || 0), 0) || 0;

      let capitalInjected = 0;
      let capitalWithdrawals = 0;
      
      cashTransactionsData?.forEach(transaction => {
        const amount = parseFloat(transaction.amount) || 0;
        if (transaction.transaction_type === 'starting_balance' || transaction.transaction_type === 'capital_injection') {
          capitalInjected += amount;
        } else if (transaction.transaction_type === 'capital_withdrawal') {
          capitalWithdrawals += amount;
        }
      });

      const totalInflow = salesRevenue + investmentsReceived + capitalInjected;
      const totalOutflow = expensesPaid + loanRepayments + goodsPurchases + capitalWithdrawals;
      const availableCashBalance = totalInflow - totalOutflow;

      const recentTransactions = [
        ...(salesData?.slice(-10).map((sale) => ({ id: `sale-${sale.id}`, date: sale.date, type: 'inflow', category: 'Sales Revenue', amount: parseFloat(sale.paid) || 0, description: 'Product sales payment received' })) || []),
        ...(expensesData?.slice(-10).map((expense) => ({ id: `expense-${expense.id}`, date: expense.date, type: 'outflow', category: expense.category || 'Operating Expenses', amount: parseFloat(expense.amount) || 0, description: expense.description || 'Business expense payment' })) || []),
        ...(goodsPurchasesData?.slice(-10).map((purchase) => ({ id: `purchase-${purchase.id}`, date: purchase.purchase_date, type: 'outflow', category: 'Goods Purchase', amount: parseFloat(purchase.amount) || 0, description: `Purchase from ${purchase.supplier_name || 'Supplier'}` })) || []),
        ...(cashTransactionsData?.slice(-10).map((transaction) => ({ id: `capital-${transaction.id}`, date: transaction.transaction_date, type: transaction.transaction_type === 'capital_withdrawal' ? 'outflow' : 'inflow', category: transaction.transaction_type.replace(/_/g, ' '), amount: parseFloat(transaction.amount) || 0, description: transaction.description || `${transaction.transaction_type.replace(/_/g, ' ')} transaction` })) || []),
        ...(investmentsData?.slice(-10).map((investment) => ({ id: `investment-${investment.id}`, date: investment.created_at?.split('T')[0], type: 'inflow', category: 'Investment Received', amount: parseFloat(investment.amount) || 0, description: `Investment from ${investment.investor_name || 'Investor'}` })) || []),
        ...(loanPaymentsData?.slice(-10).map((payment) => ({ id: `loan-${payment.id}`, date: payment.payment_date?.split('T')[0] || payment.payment_date, type: 'outflow', category: 'Loan Payment', amount: parseFloat(payment.amount) || 0, description: 'Loan repayment made' })) || [])
      ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);

      const monthlyTrend = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setUTCMonth(date.getUTCMonth() - i, 1);
        date.setUTCHours(0, 0, 0, 0);

        const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
        const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
        
        const monthSales = salesData?.filter(sale => { const d = parseDateUTC(sale.date); return d && d >= monthStart && d <= monthEnd; }).reduce((s, a) => s + (parseFloat(a.paid) || 0), 0) || 0;
        const monthExpenses = expensesData?.filter(exp => { const d = parseDateUTC(exp.date); return d && d >= monthStart && d <= monthEnd; }).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0) || 0;
        const monthGoodsPurchases = goodsPurchasesData?.filter(pur => { const d = parseDateUTC(pur.purchase_date); return d && d >= monthStart && d <= monthEnd; }).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0) || 0;
        const monthLoanPayments = loanPaymentsData?.filter(p => { const d = parseDateUTC(p.payment_date); return d && d >= monthStart && d <= monthEnd; }).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0) || 0;
        const monthInvestments = investmentsData?.filter(inv => { const d = parseDateUTC(inv.created_at); return d && d >= monthStart && d <= monthEnd; }).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0) || 0;

        let monthCapitalInflow = 0;
        let monthCapitalOutflow = 0;
        cashTransactionsData?.filter(t => { const d = parseDateUTC(t.transaction_date); return d && d >= monthStart && d <= monthEnd; }).forEach(t => {
          const amount = parseFloat(t.amount) || 0;
          if (t.transaction_type === 'capital_withdrawal') monthCapitalOutflow += amount;
          else monthCapitalInflow += amount;
        });

        monthlyTrend.push({
          month: monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          inflow: monthSales + monthInvestments + monthCapitalInflow,
          outflow: monthExpenses + monthGoodsPurchases + monthLoanPayments + monthCapitalOutflow
        });
      }

      setData({ availableCashBalance, totalInflow, totalOutflow, salesRevenue, investmentsReceived, capitalInjected, expensesPaid, loanRepayments, goodsPurchases, capitalWithdrawals, transactions: recentTransactions, monthlyTrend });

    } catch (err) {
      console.error('Error in fetchCashBalance:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCashBalance();

    const channel = supabase
      .channel('cash-balance-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, fetchCashBalance)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, fetchCashBalance)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_transactions' }, fetchCashBalance)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investments' }, fetchCashBalance)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_payments' }, fetchCashBalance)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goods_purchases' }, fetchCashBalance)
      .subscribe();

    return () => {
      console.log('Cleaning up real-time subscriptions...');
      supabase.removeChannel(channel);
    };
  }, []);

  return { data, loading, error, refetch: fetchCashBalance };
};

const AddTransactionModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    type: 'cash_transaction',
    transaction_type: 'capital_injection',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    supplier_name: '',
    category: 'General'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      let result;
      
      if (formData.type === 'cash_transaction') {
        result = await supabase.from('cash_transactions').insert([{ transaction_type: formData.transaction_type, amount: parseFloat(formData.amount), description: formData.description, transaction_date: formData.date }]);
      } else if (formData.type === 'expense') {
        result = await supabase.from('expenses').insert([{ amount: parseFloat(formData.amount), description: formData.description, date: formData.date, category: formData.category }]);
      } else if (formData.type === 'goods_purchase') {
        result = await supabase.from('goods_purchases').insert([{ supplier_name: formData.supplier_name || 'Unknown Supplier', amount: parseFloat(formData.amount), description: formData.description, purchase_date: formData.date, payment_status: 'paid' }]);
      }

      if (result.error) throw result.error;
      
      onSuccess();
      onClose();
      
      setFormData({ type: 'cash_transaction', transaction_type: 'capital_injection', amount: '', description: '', date: new Date().toISOString().split('T')[0], supplier_name: '', category: 'General' });
    } catch (err) {
      console.error('Error adding transaction:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Add New</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X className="w-4 h-4" /></button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
              <option value="cash_transaction">Capital Transaction</option>
              <option value="expense">Expense</option>
              <option value="goods_purchase">Goods Purchase</option>
            </select>
          </div>

          {formData.type === 'cash_transaction' && (
            <div>
              <label className="block text-sm font-medium mb-1">Transaction Type</label>
              <select value={formData.transaction_type} onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                <option value="capital_injection">Capital Injection</option>
                <option value="capital_withdrawal">Capital Withdrawal</option>
                <option value="starting_balance">Starting Balance</option>
              </select>
            </div>
          )}

          {formData.type === 'expense' && (
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <input type="text" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" placeholder="Expense category" required />
            </div>
          )}

          {formData.type === 'goods_purchase' && (
            <div>
              <label className="block text-sm font-medium mb-1">Supplier Name</label>
              <input type="text" value={formData.supplier_name} onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" placeholder="Enter supplier name" required />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Amount (₹)</label>
            <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" placeholder="Enter amount" required />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 h-20 resize-none" placeholder="Enter description" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" required />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">{saving ? 'Saving...' : 'Save Transaction'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CashBalancePage = () => {
  const { data, loading, error, refetch } = useCashBalance();
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount || 0);
  };

  const formatCompactCurrency = (amount) => {
    if (amount === null || amount === undefined) return '₹0';
    const absAmount = Math.abs(amount);
    if (absAmount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
    if (absAmount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    return formatCurrency(amount);
  };

  const filteredTransactions = data?.transactions?.filter(t => (t.category?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (t.description?.toLowerCase() || '').includes(searchTerm.toLowerCase())) || [];

  const downloadCSV = () => {
    if (!data?.transactions) return;
    const csvContent = [['Date', 'Type', 'Category', 'Description', 'Amount'], ...data.transactions.map(t => [new Date(t.date).toLocaleDateString('en-IN'), t.type, t.category, `"${t.description.replace(/"/g, '""')}"`, t.amount])].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash_balance_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 dark:from-gray-900 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="w-48 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
              <div className="w-64 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
            <div className="w-32 h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-xl border dark:border-gray-700"><div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div><div className="w-32 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div></div>)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 dark:from-gray-900 p-6 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl border border-red-200 dark:border-red-800 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button onClick={refetch} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen   p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              Cash Balance Management
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={refetch} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"><RefreshCw className="w-4 h-4" />Refresh</button>
            <button onClick={() => setShowAddTransaction(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"><Plus className="w-4 h-4" />Add</button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 rounded-xl border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-400">Available Cash Balance</p>
                <p className="text-3xl font-bold text-green-900 dark:text-green-300 mt-1">{formatCompactCurrency(data?.availableCashBalance)}</p>
                <p className="text-xs text-green-600 dark:text-green-500 mt-1">{formatCurrency(data?.availableCashBalance)}</p>
              </div>
              <div className="w-12 h-12 bg-green-200 dark:bg-green-800 rounded-xl flex items-center justify-center"><Wallet className="w-6 h-6 text-green-700 dark:text-green-300" /></div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-400">Total Inflows</p>
                <p className="text-3xl font-bold text-blue-900 dark:text-blue-300 mt-1">{formatCompactCurrency(data?.totalInflow)}</p>
                <p className="text-xs text-blue-600 dark:text-blue-500 mt-1 flex items-center gap-1"><ArrowUpRight className="w-3 h-3" />All time total</p>
              </div>
              <div className="w-12 h-12 bg-blue-200 dark:bg-blue-800 rounded-xl flex items-center justify-center"><TrendingUp className="w-6 h-6 text-blue-700 dark:text-blue-300" /></div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 p-6 rounded-xl border border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-400">Total Outflows</p>
                <p className="text-3xl font-bold text-red-900 dark:text-red-300 mt-1">{formatCompactCurrency(data?.totalOutflow)}</p>
                <p className="text-xs text-red-600 dark:text-red-500 mt-1 flex items-center gap-1"><ArrowDownRight className="w-3 h-3" />All time total</p>
              </div>
              <div className="w-12 h-12 bg-red-200 dark:bg-red-800 rounded-xl flex items-center justify-center"><TrendingDown className="w-6 h-6 text-red-700 dark:text-red-300" /></div>
            </div>
          </div>
        </div>

        {/* Charts & Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cash Flow Trend (6 Months)</h3>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              {data?.monthlyTrend?.map((month, index) => {
                const netFlow = month.inflow - month.outflow;
                const maxValue = Math.max(...data.monthlyTrend.map(m => Math.max(m.inflow, m.outflow)), 1);
                return (
                  <div key={`${month.month}-${index}`} className="space-y-2">
                    <div className="flex items-center justify-between text-sm"><span className="font-medium">{month.month}</span><span className={`font-semibold ${netFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>{netFlow >= 0 ? '+' : ''}{formatCompactCurrency(netFlow)}</span></div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2"><div className="w-16 text-xs text-gray-500">Inflow</div><div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-green-500 to-emerald-500" style={{ width: `${(month.inflow / maxValue) * 100}%` }} /></div><div className="w-20 text-xs text-right font-medium">{formatCompactCurrency(month.inflow)}</div></div>
                      <div className="flex items-center gap-2"><div className="w-16 text-xs text-gray-500">Outflow</div><div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-red-500 to-pink-500" style={{ width: `${(month.outflow / maxValue) * 100}%` }} /></div><div className="w-20 text-xs text-right font-medium">{formatCompactCurrency(month.outflow)}</div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cash Flow Breakdown</h3>
              <PieChart className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-green-800 dark:text-green-400 flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full"></div>Inflows (All Time)</h4>
                <div className="space-y-2 pl-5">
                  <div className="flex items-center justify-between"><span className="text-sm text-gray-600 dark:text-gray-400">Sales Revenue</span><span className="text-sm font-medium text-green-600">{formatCompactCurrency(data?.salesRevenue)}</span></div>
                  {data?.investmentsReceived > 0 && <div className="flex items-center justify-between"><span className="text-sm text-gray-600 dark:text-gray-400">Investments</span><span className="text-sm font-medium text-green-600">{formatCompactCurrency(data.investmentsReceived)}</span></div>}
                  {data?.capitalInjected > 0 && <div className="flex items-center justify-between"><span className="text-sm text-gray-600 dark:text-gray-400">Capital Injected</span><span className="text-sm font-medium text-green-600">{formatCompactCurrency(data.capitalInjected)}</span></div>}
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-red-800 dark:text-red-400 flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"></div>Outflows (All Time)</h4>
                <div className="space-y-2 pl-5">
                  <div className="flex items-center justify-between"><span className="text-sm text-gray-600 dark:text-gray-400">Operating Expenses</span><span className="text-sm font-medium text-red-600">{formatCompactCurrency(data?.expensesPaid)}</span></div>
                  {data?.loanRepayments > 0 && <div className="flex items-center justify-between"><span className="text-sm text-gray-600 dark:text-gray-400">Loan Repayments</span><span className="text-sm font-medium text-red-600">{formatCompactCurrency(data.loanRepayments)}</span></div>}
                  {/* {data?.goodsPurchases > 0 && <div className="flex items-center justify-between"><span className="text-sm text-gray-600 dark:text-gray-400">Goods Purchases</span><span className="text-sm font-medium text-red-600">{formatCompactCurrency(data.goodsPurchases)}</span></div>} */}
                  {data?.capitalWithdrawals > 0 && <div className="flex items-center justify-between"><span className="text-sm text-gray-600 dark:text-gray-400">Capital Withdrawals</span><span className="text-sm font-medium text-red-600">{formatCompactCurrency(data.capitalWithdrawals)}</span></div>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Transactions</h3>
              <div className="flex items-center gap-3">
                <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search transactions..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm w-64" /></div>
                <button onClick={downloadCSV} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"><Download className="w-4 h-4" />Export</button>
              </div>
            </div>
          </div>
          <div className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTransactions.length === 0 ? (<tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">{searchTerm ? 'No transactions found matching your search.' : 'No transactions found.'}</td></tr>) : (
                filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{new Date(transaction.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${transaction.type === 'inflow' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'}`}>{transaction.type === 'inflow' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{transaction.type === 'inflow' ? 'Inflow' : 'Outflow'}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{transaction.category}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">{transaction.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><span className={transaction.type === 'inflow' ? 'text-green-600' : 'text-red-600'}>{transaction.type === 'inflow' ? '+' : '-'}{formatCurrency(transaction.amount)}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div></div>
          {filteredTransactions.length > 0 && (<div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700"><p className="text-sm text-gray-600 dark:text-gray-400">Showing {filteredTransactions.length} of {data?.transactions?.length || 0} transactions</p></div>)}
        </div>
      </div>
      <AddTransactionModal isOpen={showAddTransaction} onClose={() => setShowAddTransaction(false)} onSuccess={refetch} />
    </div>
  );
};

export default CashBalancePage;
