import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { format, subMonths, subYears, addDays } from 'date-fns';
import { DateRange } from 'react-day-picker';
import * as XLSX from 'xlsx';
import ExcelImportExpenses from './ExcelImportExpenses';

// UI & Icons
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from '@/lib/utils';
import { Search, Trash2, Plus, Upload, Undo, Calendar as CalendarIcon, Wallet, Hash, BarChart, Tag } from 'lucide-react';
import Select from 'react-select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

// --- INTERFACES & CONSTANTS ---
interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
}

interface UndoOperation {
  type: 'delete' | 'add' | 'edit';
  data: {
    deletedRecords?: Expense[];
    addedRecord?: Expense;
    originalRecord?: Expense;
    importedRecords?: Expense[];
  };
}

const expenseCategories = ['Manufacturing', 'Marketing', 'Operations', 'Research & Development', 'Administrative', 'Travel', 'Equipment', 'Utilities', 'Legal', 'Other'];

// --- HELPER FUNCTIONS ---
const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

const getSelectStyles = (isDark: boolean) => ({
    control: (p: any) => ({ ...p, backgroundColor: isDark ? '#1F2937' : '#FFFFFF', borderColor: isDark ? '#4B5563' : '#D1D5DB' }),
    menu: (p: any) => ({ ...p, backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }),
    option: (p: any, s: any) => ({ ...p, backgroundColor: s.isSelected ? '#3B82F6' : s.isFocused ? (isDark ? '#374151' : '#F3F4F6') : 'transparent', color: s.isSelected ? '#FFFFFF' : (isDark ? '#F9FAFB' : '#111827') }),
    singleValue: (p: any) => ({ ...p, color: isDark ? '#F9FAFB' : '#111827' }),
});

// --- MAIN COMPONENT ---
const AdminExpenses: React.FC = () => {
    // --- STATE MANAGEMENT ---
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [addingNew, setAddingNew] = useState(false);
    const [newExpense, setNewExpense] = useState<Partial<Omit<Expense, 'id'>>>({ date: format(new Date(), 'yyyy-MM-dd'), amount: 0, category: '', description: '' });
    const [editingCell, setEditingCell] = useState<{ rowId: string; field: keyof Expense } | null>(null);
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [date, setDate] = useState<DateRange | undefined>({ from: new Date(new Date().getFullYear(), new Date().getMonth(), 1), to: addDays(new Date(), 0) });
    const [undoStack, setUndoStack] = useState<UndoOperation[]>([]);
    const [isUndoing, setIsUndoing] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: keyof Expense | null; direction: 'ascending' | 'descending' }>({ key: 'date', direction: 'descending' });
    const [isDarkMode, setIsDarkMode] = useState(false);
    const { toast } = useToast();
     const [isDialogOpen, setDialogOpen] = useState(false);
      const [isPopoverOpen, setPopoverOpen] = useState(false);
            const [customDate, setCustomDate] = useState<DateRange | undefined>(date);


    // --- DATA FETCHING & SIDE EFFECTS ---
    
    const fetchExpenses = async () => {
        if (!date?.from || !date?.to) return;
        setLoading(true);
        const { data, error } = await supabase.from('expenses').select('*').gte('date', date.from.toISOString()).lte('date', date.to.toISOString());
        if (error) {
            toast({ title: "Error", description: "Failed to fetch expenses.", variant: "destructive" });
        } else {
            setExpenses(data as Expense[]);
        }
        setLoading(false);
    };

    useEffect(() => { fetchExpenses(); }, [date]);
    useEffect(() => { 
        const checkDarkMode = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
        checkDarkMode();
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    // --- DATA PROCESSING (FILTERING & SORTING) ---
    const sortedExpenses = useMemo(() => {
        let filtered = expenses.filter(exp => {
            const lowerSearch = searchTerm.toLowerCase();
            return (exp.description || '').toLowerCase().includes(lowerSearch) || (exp.category || '').toLowerCase().includes(lowerSearch);
        });
        if (sortConfig.key) {
            filtered.sort((a, b) => {
                const valA = a[sortConfig.key!];
                const valB = b[sortConfig.key!];
                if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [expenses, searchTerm, sortConfig]);

    // --- DASHBOARD METRICS ---
    const dashboardStats = useMemo(() => {
        const total = sortedExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
        const count = sortedExpenses.length;
        const categoryCounts = sortedExpenses.reduce((acc, exp) => {
            acc[exp.category] = (acc[exp.category] || 0) + Number(exp.amount || 0);
            return acc;
        }, {} as Record<string, number>);
        const topCategory = Object.entries(categoryCounts).sort(([, a], [, b]) => b - a)[0];
        return {
            total,
            count,
            average: count > 0 ? total / count : 0,
            topCategory: topCategory ? topCategory[0] : 'N/A',
        };
    }, [sortedExpenses]);

    // --- CORE LOGIC HANDLERS (CRUD, UNDO, ETC.) ---
    const addToUndoStack = (operation: UndoOperation) => {
        if (isUndoing) return;
        setUndoStack(prev => [...prev, operation].slice(-10));
    };

      const handleApplyCustomDate = () => {
    setDate(customDate); // Apply the date from the dialog
    setDialogOpen(false);  // Close the dialog
    setPopoverOpen(false); // Close the main popover
   };

const handleAddNew = async () => {
    // Validation check remains the same
    if (!newExpense.category || !newExpense.date || Number(newExpense.amount) <= 0) {
        return toast({
            title: "Missing Fields",
            description: "Category, Date, and a valid Amount (> 0) are required.",
            variant: "destructive"
        });
    }

    // **REMOVED**: The code that gets the user ID is no longer needed.

    // Prepare the record for insertion without the user_id
    const recordToInsert = {
        ...newExpense,
        amount: Number(newExpense.amount),
    };

    const { data, error } = await supabase
        .from('expenses')
        .insert(recordToInsert) // Use the object without user_id
        .select()
        .single();
        
    if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
        setExpenses(prev => [data, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        addToUndoStack({ type: 'add', data: { addedRecord: data } });
        setNewExpense({ date: format(new Date(), 'yyyy-MM-dd'), amount: 0, category: '', description: '' });
        setAddingNew(false);
        toast({ title: "Success", description: "Expense added." });
    }
};
    
    const handleEditChange = async (id: string, field: keyof Expense, value: any) => {
        const originalRecord = expenses.find(exp => exp.id === id);
        if (!originalRecord) return;
        
        const updatedRecord = { ...originalRecord, [field]: value };
        setExpenses(expenses.map(exp => (exp.id === id ? updatedRecord : exp)));
        setEditingCell(null);
        
        addToUndoStack({ type: 'edit', data: { originalRecord } });
        
        const { error } = await supabase.from('expenses').update({ [field]: value }).eq('id', id);
        if (error) {
            setExpenses(expenses);
            toast({ title: "Update Failed", description: error.message, variant: "destructive" });
        }
    };

    const handleDelete = async () => {
        if (selectedRows.length === 0) return;
        const deletedRecords = expenses.filter(exp => selectedRows.includes(exp.id));
        addToUndoStack({ type: 'delete', data: { deletedRecords } });

        setExpenses(expenses.filter(exp => !selectedRows.includes(exp.id)));
        const { error } = await supabase.from('expenses').delete().in('id', selectedRows);

        if (error) {
            setExpenses(prev => [...prev, ...deletedRecords]);
            toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Success", description: `${deletedRecords.length} expense(s) deleted.` });
            setSelectedRows([]);
        }
    };

    const handleImportedData = async (importedRows: any[]) => {
    if (!importedRows || importedRows.length === 0) {
        return toast({ title: "No Data", description: "The imported file is empty or invalid.", variant: "destructive" });
    }

    // Expects Excel columns named: Date, Category, Description, Amount
    const processedData = importedRows.map(row => ({
        date: new Date(row.Date).toISOString().split('T')[0], // Format date correctly
        category: row.Category,
        description: row.Description,
        amount: Number(row.Amount),
    })).filter(d => d.category && d.date && !isNaN(d.amount));

    if (processedData.length === 0) {
        return toast({ title: "Invalid Data", description: "No valid expense rows found. Check column names and data.", variant: "destructive" });
    }

    const { data, error } = await supabase.from('expenses').insert(processedData).select();
    if (error) {
        toast({ title: "Import Failed", description: error.message, variant: "destructive" });
    } else {
        addToUndoStack({ type: 'import', data: { importedRecords: data } });
        fetchExpenses();
        toast({ title: "Success", description: `${data.length} expenses imported.` });
    }
};
    
    const handleUndo = async () => {
        if (undoStack.length === 0) return;
        setIsUndoing(true);
        const lastOp = undoStack.pop()!;
        
        try {
            switch (lastOp.type) {
                case 'add': await supabase.from('expenses').delete().eq('id', lastOp.data.addedRecord!.id); break;
                case 'delete': await supabase.from('expenses').insert(lastOp.data.deletedRecords!.map(({ id, ...rest }) => rest)); break;
                case 'edit': await supabase.from('expenses').update(lastOp.data.originalRecord!).eq('id', lastOp.data.originalRecord!.id); break;
            }
            fetchExpenses();
            toast({ title: "Action Undone" });
        } catch (error: any) {
            toast({ title: "Undo Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsUndoing(false);
        }
    };

    const handleExportToExcel = () => {
        const dataToExport = sortedExpenses.map(e => ({ Date: e.date, Category: e.category, Description: e.description, Amount: e.amount }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");
        XLSX.writeFile(workbook, "Expenses_Report.xlsx");
    };

    // --- UI HANDLERS ---
    const requestSort = (key: keyof Expense) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleSelectAll = (checked: boolean | 'indeterminate') => {
        setSelectedRows(checked ? sortedExpenses.map(e => e.id) : []);
    };
    
    // --- RENDER LOGIC ---
    const renderEditableCell = (expense: Expense, field: keyof Expense) => {
        const isEditing = editingCell?.rowId === expense.id && editingCell.field === field;
        if (isEditing) {
            if (field === 'category') {
                return (
                    <TableCell className="p-1">
                        <Select
                            options={expenseCategories.map(c => ({ value: c, label: c }))}
                            defaultValue={{ value: expense.category, label: expense.category }}
                            onChange={(opt: any) => handleEditChange(expense.id, 'category', opt.value)}
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
                        type={field === 'date' ? 'date' : field === 'amount' ? 'number' : 'text'}
                        defaultValue={expense[field] as any}
                        onBlur={(e) => handleEditChange(expense.id, field, field === 'amount' ? Number(e.target.value) : e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        autoFocus
                        className="h-8"
                    />
                </TableCell>
            );
        }
        return (
            <TableCell onClick={() => setEditingCell({ rowId: expense.id, field })} className={cn("cursor-pointer", field === 'amount' && 'text-right font-semibold')}>
                {field === 'amount' ? formatCurrency(Number(expense.amount)) : String(expense[field] ?? '')}
            </TableCell>
        );
    };

    if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    return (
        <TooltipProvider>
            <div className="p-4 md:p-8 space-y-6">
                {/* Dashboard Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Expenses</CardTitle><Wallet className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(dashboardStats.total)}</div></CardContent></Card>
                    <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Expense Count</CardTitle><Hash className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{dashboardStats.count}</div></CardContent></Card>
                    <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Average Expense</CardTitle><BarChart className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(dashboardStats.average)}</div></CardContent></Card>
                    <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Top Category</CardTitle><Tag className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{dashboardStats.topCategory}</div></CardContent></Card>
                </div>

                {/* Main Table Card */}
                <Card>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <CardTitle>Expense Records</CardTitle>
                            <div className="flex items-center gap-2">
                                <Tooltip delayDuration={0}><TooltipTrigger asChild><Button onClick={handleUndo} variant="outline" size="icon" disabled={undoStack.length === 0}><Undo className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Undo</p></TooltipContent></Tooltip>
                                <ExcelImportExpenses onDataParsed={handleImportedData} />
                                <Tooltip delayDuration={0}><TooltipTrigger asChild><Button onClick={handleExportToExcel} variant="outline" size="icon"><Upload className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Export</p></TooltipContent></Tooltip>
                                <Tooltip delayDuration={0}><TooltipTrigger asChild><Button size="icon" onClick={() => setAddingNew(true)} disabled={addingNew}><Plus className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Add new</p></TooltipContent></Tooltip>
                            </div>
                        </div>
                        <div className="flex flex-col md:flex-row items-center gap-2 mt-4">
                            <div className="relative flex-grow w-full"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search expenses..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                                       <Popover open={isPopoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn("w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (date.to ? (`${format(date.from, "LLL dd, y")} - ${format(date.to, "LLL dd, y")}`) : format(date.from, "LLL dd, y")) : (<span>Pick a date</span>)}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 flex" side="bottom" align="start">
                    {/* Presets Column */}
                    <div className="flex flex-col space-y-1 p-2 border-r">
                        <Button variant="ghost" onClick={() => { setDate({ from: new Date(), to: new Date() }); setPopoverOpen(false); }}>Today</Button>
                        <Button variant="ghost" onClick={() => { setDate({ from: addDays(new Date(), -7), to: new Date() }); setPopoverOpen(false); }}>Last 7 Days</Button>
                        <Button variant="ghost" onClick={() => { setDate({ from: addDays(new Date(), -30), to: new Date() }); setPopoverOpen(false); }}>Last 30 Days</Button>
                        <Button variant="ghost" onClick={() => { setDate({ from: subMonths(new Date(), 2), to: new Date() }); setPopoverOpen(false); }}>Last 2 Months</Button>
                        <Button variant="ghost" onClick={() => { setDate({ from: subMonths(new Date(), 6), to: new Date() }); setPopoverOpen(false); }}>Last 6 Months</Button>
                        <Button variant="ghost" onClick={() => { setDate({ from: subYears(new Date(), 1), to: new Date() }); setPopoverOpen(false); }}>Last 1 Year</Button>
                        <Button variant="ghost" onClick={() => { setDate({ from: subYears(new Date(), 50), to: new Date() }); setPopoverOpen(false); }}>All Time</Button>

                        {/* Custom Range Dialog */}
                        <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="ghost" className="text-blue-600 hover:text-blue-700 justify-start">Custom...</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>Select Custom Date Range</DialogTitle></DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !customDate?.from && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {customDate?.from ? format(customDate.from, "dd-MM-yyyy") : <span>Start Date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={customDate?.from} onSelect={(day) => setCustomDate((prev) => ({ ...prev, from: day }))} /></PopoverContent>
                                    </Popover>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !customDate?.to && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {customDate?.to ? format(customDate.to, "dd-MM-yyyy") : <span>End Date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                          <Calendar
                                            mode="single"
                                            selected={customDate?.to}
                                            onSelect={(day) =>
                                              setCustomDate((prev) =>
                                                prev
                                                  ? { from: prev.from ?? undefined, to: day }
                                                  : { from: undefined, to: day }
                                              )
                                            }
                                          />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                    <Button onClick={handleApplyCustomDate}>Apply</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Main Calendar */}
                    {/* <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={2}
                    /> */}
                </PopoverContent>
            </Popover>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-background">
                                    <TableRow>
                                        <TableHead className="w-[50px]"><Checkbox onCheckedChange={checked => handleSelectAll(checked === true)} checked={sortedExpenses.length > 0 && selectedRows.length === sortedExpenses.length} /></TableHead>
                                        <TableHead onClick={() => requestSort('date')} className="cursor-pointer">Date</TableHead>
                                        <TableHead onClick={() => requestSort('category')} className="cursor-pointer">Category</TableHead>
                                        <TableHead onClick={() => requestSort('description')} className="cursor-pointer">Description</TableHead>
                                        <TableHead onClick={() => requestSort('amount')} className="text-right cursor-pointer">Amount</TableHead>
                                        <TableHead className="text-right pr-4"><Tooltip delayDuration={0}><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handleDelete} disabled={selectedRows.length === 0}><Trash2 className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent><p>Delete selected</p></TooltipContent></Tooltip></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {addingNew && (
                                        <TableRow className="bg-muted/50">
                                            <TableCell></TableCell>
                                            <TableCell className="p-1"><Input type="date" className="h-8" value={newExpense.date || ''} onChange={e => setNewExpense(p => ({...p, date: e.target.value}))}/></TableCell>
                                            <TableCell className="p-1 min-w-[200px]"><Select options={expenseCategories.map(c => ({ value: c, label: c }))} onChange={(opt: any) => setNewExpense(p => ({ ...p, category: opt.value }))} placeholder="Select category..." styles={getSelectStyles(isDarkMode)}/></TableCell>
                                            <TableCell className="p-1"><Input className="h-8" placeholder="Expense description..." value={newExpense.description || ''} onChange={e => setNewExpense(p => ({...p, description: e.target.value}))}/></TableCell>
                                            <TableCell className="p-1"><Input type="number" className="h-8 w-24 text-right" value={newExpense.amount || ''} onChange={e => setNewExpense(p => ({...p, amount: Number(e.target.value)}))} /></TableCell>
                                            <TableCell className="p-1 text-right"><div className="flex gap-2 justify-end"><Button onClick={handleAddNew} size="sm">Save</Button><Button onClick={() => setAddingNew(false)} variant="ghost" size="sm">Cancel</Button></div></TableCell>
                                        </TableRow>
                                    )}
                                    {sortedExpenses.length > 0 ? sortedExpenses.map(expense => (
                                        <TableRow key={expense.id} data-state={selectedRows.includes(expense.id) ? "selected" : undefined}>
                                            <TableCell><Checkbox onCheckedChange={checked => setSelectedRows(p => checked ? [...p, expense.id] : p.filter(id => id !== expense.id))} checked={selectedRows.includes(expense.id)} /></TableCell>
                                            {renderEditableCell(expense, 'date')}
                                            {renderEditableCell(expense, 'category')}
                                            {renderEditableCell(expense, 'description')}
                                            {renderEditableCell(expense, 'amount')}
                                            <TableCell></TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow><TableCell colSpan={6} className="text-center h-24">No expenses found for the selected period.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </TooltipProvider>
    );
};

export default AdminExpenses;