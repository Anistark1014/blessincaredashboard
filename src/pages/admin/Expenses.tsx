import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Search, Trash2, Plus, Upload, Download, Filter, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

// UI Components from shadcn/ui
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils'; // Make sure you have this utility from shadcn

// --- Interfaces and Constants ---
interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  description: string;
}

const expenseCategories = ['Manufacturing', 'Marketing', 'Operations', 'Research & Development', 'Administrative', 'Travel', 'Equipment', 'Utilities', 'Legal', 'Other'];
const PIE_CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF5733', '#C70039', '#900C3F', '#581845', '#1B4F72'];

// --- Main Component ---
const AdminExpenses: React.FC = () => {
  // --- State Management ---
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ category: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), description: '' });
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<DateRange | undefined>(undefined);
  const { toast } = useToast();

  // --- Data Fetching and Real-time Updates ---
  useEffect(() => {
    const fetchExpenses = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
        if (error) throw error;
        setExpenses(data as Expense[]);
      } catch (error: any) {
        toast({ title: "Error", description: "Failed to fetch expenses", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchExpenses();

    const subscription = supabase.channel('expenses_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => fetchExpenses())
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, [toast]);

  // --- Data Processing and Filtering ---
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      const matchesSearch = expense.description.toLowerCase().includes(searchTerm.toLowerCase()) || expense.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter.length === 0 || categoryFilter.includes(expense.category);
      const matchesDate = !dateFilter || (dateFilter.from && dateFilter.to && expenseDate >= dateFilter.from && expenseDate <= dateFilter.to);
      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [expenses, searchTerm, categoryFilter, dateFilter]);

  const expensesByCategory = useMemo(() => {
    const categoryMap: { [key: string]: number } = {};
    filteredExpenses.forEach(expense => {
      categoryMap[expense.category] = (categoryMap[expense.category] || 0) + expense.amount;
    });
    return Object.entries(categoryMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  const totalExpenses = useMemo(() => filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0), [filteredExpenses]);

  // --- Event Handlers ---
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category || !formData.amount || !formData.date) {
      toast({ title: "Error", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('expenses').insert({ ...formData, amount: Number(formData.amount), user_id: user.id });
    if (error) {
      toast({ title: "Error adding expense", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Expense added successfully." });
      setDialogOpen(false);
      setFormData({ category: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), description: '' });
    }
  };

  const handleDelete = async (ids: string[]) => {
    if (ids.length === 0) return;
    
    // For Undo, we need original data
    const expensesToDelete = expenses.filter(exp => ids.includes(exp.id));

    // Optimistic UI update
    setExpenses(current => current.filter(exp => !ids.includes(exp.id)));
    setSelectedRows([]);

    // Permanent deletion after a delay
    const deleteTimer = setTimeout(async () => {
        const { error } = await supabase.from('expenses').delete().in('id', ids);
        if (error) {
            // On failure, restore data
            setExpenses(current => [...current, ...expensesToDelete].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            toast({ title: "Error", description: "Failed to delete expenses.", variant: "destructive" });
        }
    }, 5000);

    // Toast with Undo action
    toast({
        title: `${ids.length} Expense(s) Deleted`,
        description: "They will be permanently removed shortly.",
        duration: 5000,
        action: (
            <Button variant="outline" onClick={() => {
                clearTimeout(deleteTimer);
                setExpenses(current => [...current, ...expensesToDelete].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                toast({ title: "Action Reverted", description: "The expenses have been restored." });
            }}>
                Undo
            </Button>
        )
    });
  };

  // --- Render ---
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Top Section: KPIs and Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KPI Cards */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Total Expenses</CardTitle>
              <CardDescription>Sum of all expenses in the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold tracking-tighter">₹{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Expense Count</CardTitle>
              <CardDescription>Number of expense records found</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold tracking-tighter">{filteredExpenses.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Pie Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Expenses by Category</CardTitle>
            <CardDescription>A breakdown of spending across different categories.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              {expensesByCategory.length > 0 ? (
                <PieChart>
                  <Tooltip formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`} />
                  <Legend />
                  <Pie data={expensesByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {expensesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <BarChart className="h-8 w-8 mr-2" />
                  <p>No data to display for the current selection.</p>
                </div>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Table Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <CardTitle>Expense Records</CardTitle>
                <CardDescription>Manage and review all company expenses.</CardDescription>
            </div>
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleDelete(selectedRows)} disabled={selectedRows.length === 0}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete ({selectedRows.length})
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Add Expense</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add New Expense</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddExpense} className="space-y-4">
                    {/* Add Expense Form remains the same */}
                    <div>
                        <label>Category *</label>
                        <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full mt-1 input">
                            <option value="">Select category</option>
                            {expenseCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                    <div><label>Amount *</label><Input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required/></div>
                    <div><label>Date *</label><Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required/></div>
                    <div><label>Description</label><Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}/></div>
                    <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit">Save</Button></div>
                  </form>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" disabled><Download className="h-4 w-4 mr-2" /> Export</Button>
            </div>
          </div>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-2 mt-4">
            <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by description or category..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full md:w-auto"><Filter className="h-4 w-4 mr-2"/>Filter by Category</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuLabel>Categories</DropdownMenuLabel>
                    <DropdownMenuSeparator/>
                    {expenseCategories.map(category => (
                        <DropdownMenuCheckboxItem key={category} checked={categoryFilter.includes(category)} onCheckedChange={() => {
                            setCategoryFilter(current => current.includes(category) ? current.filter(c => c !== category) : [...current, category])
                        }}>
                            {category}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant={"outline"} className={cn("w-full md:w-[300px] justify-start text-left font-normal", !dateFilter && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFilter?.from ? (dateFilter.to ? <>{format(dateFilter.from, "LLL dd, y")} - {format(dateFilter.to, "LLL dd, y")}</> : format(dateFilter.from, "LLL dd, y")) : <span>Pick a date range</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="range" selected={dateFilter} onSelect={setDateFilter} numberOfMonths={2}/>
                </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><Checkbox onCheckedChange={checked => setSelectedRows(checked ? filteredExpenses.map(e => e.id) : [])} checked={selectedRows.length > 0 && selectedRows.length === filteredExpenses.length}/></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length > 0 ? filteredExpenses.map(expense => (
                  <TableRow key={expense.id} data-state={selectedRows.includes(expense.id) && "selected"}>
                    <TableCell><Checkbox onCheckedChange={checked => setSelectedRows(current => checked ? [...current, expense.id] : current.filter(id => id !== expense.id))} checked={selectedRows.includes(expense.id)} /></TableCell>
                    <TableCell>{format(new Date(expense.date), 'dd MMM, yyyy')}</TableCell>
                    <TableCell><span className="font-medium">{expense.category}</span></TableCell>
                    <TableCell className="text-muted-foreground">{expense.description || 'N/A'}</TableCell>
                    <TableCell className="text-right font-semibold">₹{expense.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={5} className="text-center h-24">No expenses found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminExpenses;