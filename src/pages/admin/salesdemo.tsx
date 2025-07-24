import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { addDays, format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import * as XLSX from 'xlsx';
import Select from 'react-select';
import EnhancedSalesDashboard from './EnhancedSalesDashboard';
import ExcelImport from './ExcelImport';
import { Search, Upload, Trash2, Plus, Undo, Calendar as CalendarIcon, Download } from 'lucide-react';

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
  email?: string;
  role?: string;
}

interface Sale {
  id: string;
  date: string;
  qty: number;
  price: number;
  total: number;
  paid: number;
  balance: number;
  payment_status: string;
  member_id: string;
  product_id: string;
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
  
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [undoStack, setUndoStack] = useState<UndoOperation[]>([]);
  const [isUndoing, setIsUndoing] = useState(false);

  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'ascending' | 'descending' }>({
    key: 'date',
    direction: 'descending',
  });

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
      setSales((data as Sale[]) || []);
    }
  };

  const fetchDropdownData = async () => {
    try {
      const usersPromise = supabase.from('users').select('id, name');
      const productsPromise = supabase.from('products').select('id, name, mrp, price_ranges');

      const [usersResult, productsResult] = await Promise.all([usersPromise, productsPromise]);

      if (usersResult.error) throw usersResult.error;
      if (productsResult.error) throw productsResult.error;

      setUsers(usersResult.data || []);
      const userOpts = (usersResult.data || [])
        .filter(u => u.name)
        .map(u => ({ label: u.name!, value: u.id }));
      setUserOptions(userOpts);
      
      setProducts(productsResult.data || []);
      const productOpts = (productsResult.data || []).map(p => ({ label: p.name, value: p.id }));
      setProductOptions(productOpts);

    } catch (error: any) {
      console.error("Error fetching dropdown data:", error.message);
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

  // --- CRUD & FEATURE FUNCTIONS ---
  const addToUndoStack = (operation: UndoOperation) => {
    if (isUndoing) return;
    setUndoStack(prev => [...prev, operation].slice(-10));
  };

  const handleAddNew = async () => {
    const requiredFields: (keyof Sale)[] = ['date', 'member_id', 'product_id', 'qty', 'price'];
    if (!requiredFields.every(field => newSale[field] != null)) {
      alert(`Please fill all required fields: Date, Member, Product, Qty, Price`);
      return;
    }

    const recordToInsert = {
        date: newSale.date,
        member_id: newSale.member_id,
        product_id: newSale.product_id,
        qty: newSale.qty,
        price: newSale.price,
        total: newSale.total,
        paid: newSale.paid ?? 0,
        balance: newSale.balance,
        payment_status: newSale.payment_status,
    };
    
    const { data, error } = await supabase.from('sales').insert([recordToInsert]).select('*, users(*), products(*)');
    
    if (error) {
      alert('Insert failed: ' + error.message);
    } else if (data) {
      const addedRecord = data[0] as Sale;
      addToUndoStack({ type: 'add', timestamp: Date.now(), data: { addedRecord } });
      setSales([addedRecord, ...sales]);
      setNewSale({});
      setAddingNew(false);
    }
  };

  const handleEditChange = async (id: string, field: keyof Sale, value: any) => {
    const originalSale = sales.find(sale => sale.id === id);
    if (!originalSale) return;

    let updatePayload: { [key: string]: any } = { [field]: value };
    let updatedRecordForUI = { ...originalSale, [field]: value };

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
    const balance = total - paid;
    const payment_status = paid >= total ? 'Fully Paid' : (paid > 0 ? 'Partially Paid' : 'Pending');
    
    const calculatedFields = { total, balance, payment_status };
    
    updatePayload = { ...updatePayload, ...calculatedFields };
    updatedRecordForUI = { ...updatedRecordForUI, ...calculatedFields };
    
    addToUndoStack({ type: 'edit', timestamp: Date.now(), data: { recordId: id, field, oldValue: originalSale[field], newValue: value, record: originalSale } });
    
    setSales(sales.map(s => s.id === id ? updatedRecordForUI : s));
    setEditingCell(null);

    const { error } = await supabase.from('sales').update(updatePayload).eq('id', id);
    if (error) {
      console.error('Update failed:', error.message);
      setSales(sales);
    }
  };

  const deleteSelectedRows = async () => {
    if (selectedRows.length === 0 || !window.confirm(`Delete ${selectedRows.length} record(s)?`)) return;

    const deletedRecords = sales.filter((s) => selectedRows.includes(s.id));
    addToUndoStack({ type: 'delete', timestamp: Date.now(), data: { deletedRecords } });

    const { error } = await supabase.from('sales').delete().in('id', selectedRows);
    if (error) {
      alert('Delete failed: ' + error.message);
    } else {
      setSales(sales.filter((s) => !selectedRows.includes(s.id)));
      setSelectedRows([]);
    }
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    setIsUndoing(true);
    const lastOperation = undoStack[undoStack.length - 1];

    try {
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
          if (lastOperation.data.record) {
            const { users, products, ...originalRecord } = lastOperation.data.record;
            await supabase.from('sales').update(originalRecord).eq('id', originalRecord.id);
          }
          break;
        case 'import':
          if (lastOperation.data.importedRecords) {
            const idsToDelete = lastOperation.data.importedRecords.map(rec => rec.id);
            await supabase.from('sales').delete().in('id', idsToDelete);
          }
          break;
      }
      setUndoStack(prev => prev.slice(0, -1));
      fetchSales();
    } catch (error: any) {
      alert('Undo failed: ' + error.message);
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
        Member: s.users?.name || 'N/A',
        Product: s.products?.name || 'N/A',
        Quantity: s.qty,
        Price: s.price,
        Total: s.total,
        Paid: s.paid,
        Balance: s.balance,
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
      
      if (!user || !product) {
        console.warn(`Skipping row due to missing user or product:`, row);
        return null;
      }

      const qty = Number(row.qty || 0);
      let price = 0;
      if (product.price_ranges && product.price_ranges.length > 0) {
        const priceRange = product.price_ranges.find(r => qty >= r.min && qty <= r.max);
        price = priceRange ? priceRange.price : product.mrp || 0;
      } else {
        price = product.mrp || 0;
      }

      const paid = Number(row.paid || 0);
      const total = qty * price;
      const balance = total - paid;
      const payment_status = paid >= total ? 'Fully Paid' : (paid > 0 ? 'Partially Paid' : 'Pending');

      return {
        date: row.date,
        member_id: user.id,
        product_id: product.id,
        qty,
        price,
        total,
        paid,
        balance,
        payment_status,
      };
    }).filter(Boolean);

    if (processedData.length === 0) {
      alert("No valid rows could be processed from the import. Please check user and product names match exactly.");
      return;
    }

    const { data: newRecords, error } = await supabase.from('sales').insert(processedData).select();

    if (error) {
      alert(`Import failed: ${error.message}`);
    } else if (newRecords) {
      alert(`${newRecords.length} rows imported successfully!`);
      addToUndoStack({ type: 'import', timestamp: Date.now(), data: { importedRecords: newRecords as Sale[] } });
      fetchSales();
    }
  };

  // --- UI HANDLERS & MEMOS ---
  const handleNewChange = (field: keyof Sale, value: any) => {
    setNewSale(prev => {
      const updated = { ...prev, [field]: value };
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
    const balance = total - paid;
    const payment_status = total > 0 && paid >= total ? 'Fully Paid' : paid > 0 ? 'Partially Paid' : 'Pending';
    
    setNewSale(prev => ({ ...prev, price, total, balance, payment_status }));
  }, [newSale.qty, newSale.product_id, newSale.paid, products]);


  const sortedSales = useMemo(() => {
    let sortableItems = sales.filter(s => {
      if (!searchTerm) return true;
      const lowerSearch = searchTerm.toLowerCase();
      const userName = s.users?.name || '';
      const productName = s.products?.name || '';
      return (
        userName.toLowerCase().includes(lowerSearch) ||
        productName.toLowerCase().includes(lowerSearch)
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
  
  // **NEW**: Memoized value to display the current date range text.
  const displayDate = useMemo(() => {
    if (!date?.from) {
        return null;
    }
    const fromMonth = format(date.from, "MMM");
    const fromYear = format(date.from, "yyyy");
    // If it's a single month view (default)
    if (date.to && (format(date.from, 'yyyyMM') === format(date.to, 'yyyyMM'))) {
        return `${fromMonth.toUpperCase()} ${fromYear}`;
    }
    // If it's a range
    if(date.to) {
        const toMonth = format(date.to, "MMM");
        const toYear = format(date.to, "yyyy");
        if (fromYear === toYear) {
            return `${fromMonth.toUpperCase()} - ${toMonth.toUpperCase()} ${fromYear}`;
        }
        return `${fromMonth.toUpperCase()} ${fromYear} - ${toMonth.toUpperCase()} ${toYear}`;
    }
    // If only a start date is selected
    return `${fromMonth.toUpperCase()} ${fromYear}`;
  }, [date]);


  // --- RENDER LOGIC ---

  const renderEditableCell = (sale: Sale, field: keyof Sale) => {
    const isEditing = editingCell?.rowId === sale.id && editingCell.field === field;
    const isCalculated = ['total', 'balance'].includes(field);
    const clickHandler = isCalculated ? undefined : () => setEditingCell({ rowId: sale.id, field });

    if (isEditing) {
      if (field === 'payment_status') {
        return (
          <TableCell className="p-1">
            <select
              className="w-full p-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-1 focus:ring-blue-500 h-8"
              value={sale.payment_status}
              onChange={(e) => handleEditChange(sale.id, field, e.target.value)}
              onBlur={() => setEditingCell(null)}
              autoFocus
            >
              <option value="Fully Paid">Fully Paid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Pending">Pending</option>
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
    
    const isCurrency = ['price', 'total', 'paid', 'balance'].includes(field);
    
    if (field === 'payment_status') {
      return (
        <TableCell className={cn("cursor-pointer font-semibold", statusColors[sale.payment_status])} onClick={clickHandler}>
          {sale.payment_status}
        </TableCell>
      );
    }

    return (
      <TableCell className={cn("cursor-pointer", isCurrency && "text-right")} onClick={clickHandler}>
        {isCurrency ? formatCurrency(Number(displayValue)) : String(displayValue ?? '')}
      </TableCell>
    );
  };

  return (
    <div className="space-y-6">
      <EnhancedSalesDashboard data={sortedSales} />
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
                <CardTitle className="text-2xl">Sales Records</CardTitle>
                {/* **NEW**: Display for the selected date range */}
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
                placeholder="Search by user or product..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Popover>
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
                  {date?.from ? (
                    date.to ? (
                      <>
                        {format(date.from, "LLL dd, y")} -{" "}
                        {format(date.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(date.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 flex" align="start">
                <div className="flex flex-col space-y-2 p-2 border-r">
                   <Button variant="ghost" onClick={() => setDate({from: new Date(), to: new Date()})}>Today</Button>
                   <Button variant="ghost" onClick={() => setDate({from: addDays(new Date(), -1), to: new Date()})}>Yesterday</Button>
                   <Button variant="ghost" onClick={() => setDate({from: addDays(new Date(), -7), to: new Date()})}>Last 7 Days</Button>
                   <Button variant="ghost" onClick={() => setDate({from: addDays(new Date(), -30), to: new Date()})}>Last 30 Days</Button>
                </div>
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-2">
              <Button onClick={handleUndo} variant="outline" size="sm" disabled={undoStack.length === 0 || isUndoing}><Undo className="h-4 w-4" /></Button>
              <ExcelImport onDataParsed={handleImportedData} />
              <Button onClick={handleExportToExcel} variant="outline" size="sm"><Download className="h-4 w-4" /></Button>
              <Button onClick={() => setAddingNew(true)} size="sm" disabled={addingNew}><Plus className="h-4 w-4" /></Button>
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
                  <TableHead onClick={() => requestSort('user')} className="cursor-pointer">Member</TableHead>
                  <TableHead onClick={() => requestSort('product')} className="cursor-pointer">Product</TableHead>
                  <TableHead onClick={() => requestSort('qty')} className="text-right cursor-pointer">Qty</TableHead>
                  <TableHead onClick={() => requestSort('price')} className="text-right cursor-pointer">Price</TableHead>
                  <TableHead onClick={() => requestSort('total')} className="text-right cursor-pointer">Total</TableHead>
                  <TableHead onClick={() => requestSort('paid')} className="text-right cursor-pointer">Paid</TableHead>
                  <TableHead onClick={() => requestSort('balance')} className="text-right cursor-pointer">Outstanding</TableHead>
                  <TableHead onClick={() => requestSort('payment_status')} className="cursor-pointer">Status</TableHead>
                  <TableHead className="text-right pr-4">
                    <Button variant="ghost" size="icon" onClick={deleteSelectedRows} disabled={selectedRows.length === 0}><Trash2 className="h-4 w-4" /></Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addingNew && (
                  <TableRow className="bg-secondary">
                    <TableCell></TableCell>
                    <TableCell className="p-1"><Input type="date" className="h-8" value={newSale.date ?? ''} onChange={(e) => handleNewChange('date' as keyof Sale, e.target.value)} /></TableCell>
                    <TableCell className="p-1 min-w-[150px]"><Select options={userOptions} onChange={(s: any) => handleNewChange('member_id' as keyof Sale, s?.value)} styles={getSelectStyles(isDarkMode)} /></TableCell>
                    <TableCell className="p-1 min-w-[150px]"><Select options={productOptions} onChange={(s: any) => handleNewChange("product_id" as keyof Sale, s?.value || "")} styles={getSelectStyles(isDarkMode)} /></TableCell>
                    <TableCell className="p-1"><Input type="number" className="h-8 w-16 text-right" value={newSale.qty ?? ''} onChange={(e) => handleNewChange('qty' as keyof Sale, Number(e.target.value))} /></TableCell>
                    <TableCell className="p-1"><Input type="number" step="0.01" className="h-8 w-24 text-right" value={newSale.price ?? ''} onChange={(e) => handleNewChange('price' as keyof Sale, Number(e.target.value))} /></TableCell>
                    <TableCell className="p-1 text-right">{formatCurrency(newSale.total ?? 0)}</TableCell>
                    <TableCell className="p-1"><Input type="number" step="0.01" className="h-8 w-24 text-right" value={newSale.paid ?? ''} onChange={(e) => handleNewChange('paid' as keyof Sale, Number(e.target.value))} /></TableCell>
                    <TableCell className="p-1 text-right">{formatCurrency(newSale.balance ?? 0)}</TableCell>
                    <TableCell className="p-1"><div className={cn("font-semibold", statusColors[newSale.payment_status || 'Pending'])}>{newSale.payment_status || 'Pending'}</div></TableCell>
                    <TableCell className="p-1 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button onClick={handleAddNew} size="sm" className="bg-green-600 hover:bg-green-700 text-white">Save</Button>
                        <Button onClick={() => setAddingNew(false)} variant="ghost" size="sm">Cancel</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {sortedSales.length > 0 ? sortedSales.map((sale) => (
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
                    {renderEditableCell(sale, 'member_id')}
                    {renderEditableCell(sale, 'product_id')}
                    {renderEditableCell(sale, 'qty')}
                    {renderEditableCell(sale, 'price')}
                    {renderEditableCell(sale, 'total')}
                    {renderEditableCell(sale, 'paid')}
                    {renderEditableCell(sale, 'balance')}
                    {renderEditableCell(sale, 'payment_status')}
                    <TableCell></TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center h-24">
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
