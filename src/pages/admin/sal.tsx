import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import MonthYearPicker from './MonthYearPicker';
import ExcelImport from './ExcelImport'; // Import the component we just created
import * as XLSX from 'xlsx';
import Select from 'react-select';

interface Sale {
  id: string;
  date: string;
  type: string;
  member: string;
  product: string;
  qty: number;
  price: number;
  total: number;
  paid: number;
  incoming: number;
  clearance: string | null;
  balance: number;
  description: string;
  payment_status: 'Fully Paid' | 'Partially Paid' | 'Pending';
}

// Enhanced Product interface to include pricing information
interface Product {
  id: string;
  name?: string;
  product_name?: string;
  product?: string;
  price?: number;
  unit_price?: number;
  cost_price?: number;
  selling_price?: number;
}

// Undo operation types
interface UndoOperation {
  type: 'delete' | 'add' | 'edit' | 'bulk_import';
  timestamp: number;
  data: {
    // For delete operations
    deletedRecords?: Sale[];
    // For add operations
    addedRecord?: Sale;
    // For edit operations
    recordId?: string;
    field?: keyof Sale;
    oldValue?: any;
    newValue?: any;
    record?: Sale;
    // For bulk import operations
    importedRecords?: Sale[];
  };
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);

const statusColors = {
  'Fully Paid': 'text-green-700 dark:text-green-400 font-semibold',
  'Partially Paid': 'text-yellow-600 dark:text-yellow-400 font-semibold',
  'Pending': 'text-red-600 dark:text-red-400 font-semibold',
};

// Custom styles for react-select to support dark mode
const getSelectStyles = (isDark: boolean) => ({
  control: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: isDark ? '#374151' : '#ffffff',
    borderColor: isDark ? '#4B5563' : '#D1D5DB',
    color: isDark ? '#F9FAFB' : '#111827',
    minHeight: '36px',
    '&:hover': {
      borderColor: isDark ? '#6B7280' : '#9CA3AF',
    },
    boxShadow: state.isFocused ? 
      (isDark ? '0 0 0 1px #3B82F6' : '0 0 0 1px #3B82F6') : 
      'none',
  }),
  menu: (provided: any) => ({
    ...provided,
    backgroundColor: isDark ? '#374151' : '#ffffff',
    border: isDark ? '1px solid #4B5563' : '1px solid #D1D5DB',
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: state.isSelected
      ? (isDark ? '#3B82F6' : '#3B82F6')
      : state.isFocused
      ? (isDark ? '#4B5563' : '#F3F4F6')
      : (isDark ? '#374151' : '#ffffff'),
    color: state.isSelected
      ? '#ffffff'
      : (isDark ? '#F9FAFB' : '#111827'),
  }),
  singleValue: (provided: any) => ({
    ...provided,
    color: isDark ? '#F9FAFB' : '#111827',
  }),
  placeholder: (provided: any) => ({
    ...provided,
    color: isDark ? '#9CA3AF' : '#6B7280',
  }),
  input: (provided: any) => ({
    ...provided,
    color: isDark ? '#F9FAFB' : '#111827',
  }),
});

const EnhancedSalesTable: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: keyof Sale } | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newSale, setNewSale] = useState<Partial<Sale>>({});
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [resellers, setResellers] = useState([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filterMember, setFilterMember] = useState<string | null>(null);
  const [filterProduct, setFilterProduct] = useState<string | null>(null);
  const [productOptions, setProductOptions] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  
  // Undo functionality state
  const [undoStack, setUndoStack] = useState<UndoOperation[]>([]);
  const [isUndoing, setIsUndoing] = useState(false);

  // Add operation to undo stack
  const addToUndoStack = (operation: UndoOperation) => {
    if (isUndoing) return; // Don't add undo operations to stack
    
    setUndoStack(prev => {
      const newStack = [...prev, operation];
      // Keep only last 10 operations to prevent memory issues
      return newStack.slice(-10);
    });
  };

  // Check for dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark') ||
                     window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(isDark);
    };

    checkDarkMode();
    
    // Listen for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addListener(checkDarkMode);

    return () => {
      observer.disconnect();
      mediaQuery.removeListener(checkDarkMode);
    };
  }, []);

  const fetchSales = async () => {
    const startDate = new Date(selectedYear, selectedMonth, 1).toISOString();
    const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999).toISOString();

    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching sales:', error.message);
    } else {
      setSales(data as Sale[]);
    }
  };

  // Enhanced function to fetch products with pricing information
  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*"); // Select all fields to get pricing information

    if (!error && data) {
      setProducts(data as Product[]);
      
      // Create options for dropdowns
      const uniqueProducts = Array.from(new Set(
        data.map((item) => 
          item.product || item.name || item.product_name
        ).filter(Boolean)
      ));
      
      const options = uniqueProducts.map((product) => ({
        label: product,
        value: product,
      }));
      setProductOptions(options);
    } else {
      console.error("Error fetching products:", error);
    }
  };

  // Function to get product price based on product name
  const getProductPrice = (productName: string): number => {
    const product = products.find(p => 
      p.product === productName || 
      p.name === productName || 
      p.product_name === productName
    );
    
    if (product) {
      // Try different price fields in order of preference
      return product.selling_price || 
             product.price || 
             product.unit_price || 
             product.cost_price || 
             0;
    }
    
    return 0;
  };

  const fetchDropdownData = async () => {
    const { data: resellerData } = await supabase.from('users').select('id, name').eq('role', 'reseller');
    setResellers(resellerData || []);

    // Use the enhanced fetchProducts function
    await fetchProducts();
  };

  useEffect(() => {
    fetchSales();
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchDropdownData();
  }, []);

  // Handle import completion
  const handleImportComplete = () => {
    fetchSales(); // Refresh the table
    setIsImportDialogOpen(false); // Close the dialog
  };

  const handleEditChange = async (id: string, field: keyof Sale, value: any) => {
    // Store old value for undo
    const oldRecord = sales.find(sale => sale.id === id);
    const oldValue = oldRecord ? oldRecord[field] : undefined;
    
    // Add to undo stack
    addToUndoStack({
      type: 'edit',
      timestamp: Date.now(),
      data: {
        recordId: id,
        field,
        oldValue,
        newValue: value,
        record: { ...oldRecord } as Sale
      }
    });

    // Update local state
    setSales(prev => prev.map(sale => 
      sale.id === id ? { ...sale, [field]: value } : sale
    ));

    // Update in database
    const { error } = await supabase
      .from('sales')
      .update({ [field]: value })
      .eq('id', id);

    if (error) {
      console.error('Error updating sale:', error.message);
      // Revert local state on error
      setSales(prev => prev.map(sale => 
        sale.id === id ? { ...sale, [field]: oldValue } : sale
      ));
    }
  };

  const handleAddNew = async () => {
    if (!newSale.date || !newSale.member || !newSale.product || !newSale.qty || !newSale.price) {
      alert('Please fill in all required fields');
      return;
    }

    // Calculate derived values
    const total = (newSale.qty || 0) * (newSale.price || 0);
    const paid = newSale.paid || 0;
    const incoming = total - paid;
    const balance = incoming;
    
    // Determine payment status
    let payment_status: 'Fully Paid' | 'Partially Paid' | 'Pending';
    if (paid === total) {
      payment_status = 'Fully Paid';
    } else if (paid === 0) {
      payment_status = 'Pending';
    } else {
      payment_status = 'Partially Paid';
    }

    const saleToAdd: Partial<Sale> = {
      ...newSale,
      total,
      incoming,
      balance,
      payment_status,
      type: newSale.type || 'sale',
      description: newSale.description || 'Manual entry'
    };

    const { data, error } = await supabase
      .from('sales')
      .insert([saleToAdd])
      .select()
      .single();

    if (error) {
      console.error('Error adding sale:', error.message);
      alert('Error adding sale: ' + error.message);
    } else {
      // Add to undo stack
      addToUndoStack({
        type: 'add',
        timestamp: Date.now(),
        data: {
          addedRecord: data as Sale
        }
      });

      setSales(prev => [data as Sale, ...prev]);
      setNewSale({});
      setAddingNew(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedRows.length === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedRows.length} selected sales?`)) {
      return;
    }

    // Store records for undo
    const recordsToDelete = sales.filter(sale => selectedRows.includes(sale.id));
    
    const { error } = await supabase
      .from('sales')
      .delete()
      .in('id', selectedRows);

    if (error) {
      console.error('Error deleting sales:', error.message);
      alert('Error deleting sales: ' + error.message);
    } else {
      // Add to undo stack
      addToUndoStack({
        type: 'delete',
        timestamp: Date.now(),
        data: {
          deletedRecords: recordsToDelete
        }
      });

      setSales(prev => prev.filter(sale => !selectedRows.includes(sale.id)));
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
          // Restore deleted records
          if (lastOperation.data.deletedRecords) {
            const { error } = await supabase
              .from('sales')
              .insert(lastOperation.data.deletedRecords);
            
            if (!error) {
              setSales(prev => [...lastOperation.data.deletedRecords!, ...prev]);
            }
          }
          break;
          
        case 'add':
          // Remove added record
          if (lastOperation.data.addedRecord) {
            const { error } = await supabase
              .from('sales')
              .delete()
              .eq('id', lastOperation.data.addedRecord.id);
            
            if (!error) {
              setSales(prev => prev.filter(sale => sale.id !== lastOperation.data.addedRecord!.id));
            }
          }
          break;
          
        case 'edit':
          // Revert field change
          if (lastOperation.data.recordId && lastOperation.data.field) {
            const { error } = await supabase
              .from('sales')
              .update({ [lastOperation.data.field]: lastOperation.data.oldValue })
              .eq('id', lastOperation.data.recordId);
            
            if (!error) {
              setSales(prev => prev.map(sale => 
                sale.id === lastOperation.data.recordId ? 
                { ...sale, [lastOperation.data.field!]: lastOperation.data.oldValue } : 
                sale
              ));
            }
          }
          break;
          
        case 'bulk_import':
          // Remove imported records
          if (lastOperation.data.importedRecords) {
            const importedIds = lastOperation.data.importedRecords.map(record => record.id);
            const { error } = await supabase
              .from('sales')
              .delete()
              .in('id', importedIds);
            
            if (!error) {
              setSales(prev => prev.filter(sale => !importedIds.includes(sale.id)));
            }
          }
          break;
      }
      
      // Remove the undone operation from stack
      setUndoStack(prev => prev.slice(0, -1));
    } catch (error) {
      console.error('Undo operation failed:', error);
      alert('Undo operation failed');
    } finally {
      setIsUndoing(false);
    }
  };

  const handleProductChange = (selectedOption: any, saleId?: string) => {
    const productName = selectedOption?.value;
    if (!productName) return;

    const price = getProductPrice(productName);
    
    if (saleId) {
      // Editing existing sale
      handleEditChange(saleId, 'product', productName);
      if (price > 0) {
        handleEditChange(saleId, 'price', price);
      }
    } else {
      // Adding new sale
      setNewSale(prev => ({ 
        ...prev, 
        product: productName,
        price: price > 0 ? price : prev.price 
      }));
    }
  };

  const exportToExcel = () => {
    const exportData = filteredSales.map(sale => ({
      'Date': sale.date,
      'Member': sale.member,
      'Product': sale.product,
      'Qty': sale.qty,
      'Price': sale.price,
      'Total': sale.total,
      'Paid': sale.paid,
      'Incoming': sale.incoming,
      'Balance': sale.balance,
      'Description': sale.description,
      'Payment Status': sale.payment_status,
      'Type': sale.type,
      'Clearance': sale.clearance
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Sales_${selectedMonth + 1}_${selectedYear}`);
    XLSX.writeFile(workbook, `Sales_${selectedMonth + 1}_${selectedYear}.xlsx`);
  };

  // Filter sales based on member and product filters
  const filteredSales = sales.filter(sale => {
    const memberMatch = !filterMember || sale.member.toLowerCase().includes(filterMember.toLowerCase());
    const productMatch = !filterProduct || sale.product.toLowerCase().includes(filterProduct.toLowerCase());
    return memberMatch && productMatch;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(filteredSales.map(sale => sale.id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleRowSelect = (saleId: string, checked: boolean) => {
    if (checked) {
      setSelectedRows(prev => [...prev, saleId]);
    } else {
      setSelectedRows(prev => prev.filter(id => id !== saleId));
    }
  };

  // Calculate totals
  const totalAmount = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalPaid = filteredSales.reduce((sum, sale) => sum + sale.paid, 0);
  const totalPending = filteredSales.reduce((sum, sale) => sum + sale.incoming, 0);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <CardTitle className="text-2xl font-bold">Sales Management</CardTitle>
          
          <div className="flex flex-wrap items-center gap-2">
            <MonthYearPicker
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onMonthChange={setSelectedMonth}
              onYearChange={setSelectedYear}
            />
            
            <Button
              onClick={() => setAddingNew(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={addingNew}
            >
              ➕ Add Sale
            </Button>
            
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  📊 Import Excel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Import Sales Data</DialogTitle>
                </DialogHeader>
                <ExcelImport onImportComplete={handleImportComplete} />
              </DialogContent>
            </Dialog>
            
            <Button
              onClick={exportToExcel}
              variant="outline"
            >
              📥 Export
            </Button>
            
            {selectedRows.length > 0 && (
              <Button
                onClick={handleDeleteSelected}
                variant="destructive"
                className="bg-red-600 hover:bg-red-700"
              >
                🗑️ Delete ({selectedRows.length})
              </Button>
            )}
            
            {undoStack.length > 0 && (
              <Button
                onClick={handleUndo}
                variant="outline"
                disabled={isUndoing}
                className="bg-yellow-500 hover:bg-yellow-600 text-white"
              >
                ↶ Undo ({undoStack.length})
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mt-4">
          <div className="flex-1 min-w-48">
            <label className="block text-sm font-medium mb-1">Filter by Member:</label>
            <input
              type="text"
              placeholder="Search member..."
              value={filterMember || ''}
              onChange={(e) => setFilterMember(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          
          <div className="flex-1 min-w-48">
            <label className="block text-sm font-medium mb-1">Filter by Product:</label>
            <input
              type="text"
              placeholder="Search product..."
              value={filterProduct || ''}
              onChange={(e) => setFilterProduct(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {(filterMember || filterProduct) && (
            <Button
              onClick={() => {
                setFilterMember(null);
                setFilterProduct(null);
              }}
              variant="outline"
              className="mt-6"
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg">
            <h3 className="font-semibold text-green-800 dark:text-green-200">Total Sales</h3>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(totalAmount)}
            </p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200">Total Paid</h3>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(totalPaid)}
            </p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg">
            <h3 className="font-semibold text-red-800 dark:text-red-200">Pending Amount</h3>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(totalPending)}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={selectedRows.length === filteredSales.length && filteredSales.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addingNew && (
                <TableRow className="bg-blue-50 dark:bg-blue-900/30">
                  <TableCell></TableCell>
                  <TableCell>
                    <input
                      type="date"
                      value={newSale.date || ''}
                      onChange={(e) => setNewSale(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-2 py-1 border rounded text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                      required
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="text"
                      placeholder="Member name"
                      value={newSale.member || ''}
                      onChange={(e) => setNewSale(prev => ({ ...prev, member: e.target.value }))}
                      className="w-full px-2 py-1 border rounded text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                      required
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      options={productOptions}
                      value={productOptions.find(option => option.value === newSale.product)}
                      onChange={(selectedOption) => handleProductChange(selectedOption)}
                      styles={getSelectStyles(isDarkMode)}
                      placeholder="Select product"
                      isClearable
                      isSearchable
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="number"
                      placeholder="Qty"
                      value={newSale.qty || ''}
                      onChange={(e) => setNewSale(prev => ({ ...prev, qty: Number(e.target.value) }))}
                      className="w-full px-2 py-1 border rounded text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                      required
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Price"
                      value={newSale.price || ''}
                      onChange={(e) => setNewSale(prev => ({ ...prev, price: Number(e.target.value) }))}
                      className="w-full px-2 py-1 border rounded text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                      required
                    />
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold">
                      {formatCurrency((newSale.qty || 0) * (newSale.price || 0))}
                    </span>
                  </TableCell>
                  <TableCell>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Paid"
                      value={newSale.paid || ''}
                      onChange={(e) => setNewSale(prev => ({ ...prev, paid: Number(e.target.value) }))}
                      className="w-full px-2 py-1 border rounded text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    />
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-red-600">
                      {formatCurrency(((newSale.qty || 0) * (newSale.price || 0)) - (newSale.paid || 0))}
                    </span>
                  </TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleAddNew}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        ✓
                      </Button>
                      <Button
                        onClick={() => {
                          setAddingNew(false);
                          setNewSale({});
                        }}
                        size="sm"
                        variant="outline"
                      >
                        ✕
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              
              {filteredSales.map((sale) => (
                <TableRow key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedRows.includes(sale.id)}
                      onChange={(e) => handleRowSelect(sale.id, e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                  </TableCell>
                  <TableCell>
                    {editingCell?.rowId === sale.id && editingCell?.field === 'date' ? (
                      <input
                        type="date"
                        value={sale.date}
                        onChange={(e) => handleEditChange(sale.id, 'date', e.target.value)}
                        onBlur={() => setEditingCell(null)}
                        autoFocus
                        className="w-full px-2 py-1 border rounded text-sm bg-white dark:bg-gray-700"
                      />
                    ) : (
                      <span
                        onClick={() => setEditingCell({ rowId: sale.id, field: 'date' })}
                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded"
                      >
                        {sale.date}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingCell?.rowId === sale.id && editingCell?.field === 'member' ? (
                      <input
                        type="text"
                        value={sale.member}
                        onChange={(e) => handleEditChange(sale.id, 'member', e.target.value)}
                        onBlur={() => setEditingCell(null)}
                        autoFocus
                        className="w-full px-2 py-1 border rounded text-sm bg-white dark:bg-gray-700"
                      />
                    ) : (
                      <span
                        onClick={() => setEditingCell({ rowId: sale.id, field: 'member' })}
                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded"
                      >
                        {sale.member}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingCell?.rowId === sale.id && editingCell?.field === 'product' ? (
                      <div style={{ minWidth: '200px' }}>
                        <Select
                          options={productOptions}
                          value={productOptions.find(option => option.value === sale.product)}
                          onChange={(selectedOption) => {
                            handleProductChange(selectedOption, sale.id);
                            setEditingCell(null);
                          }}
                          styles={getSelectStyles(isDarkMode)}
                          autoFocus
                          menuIsOpen={true}
                          placeholder="Select product"
                          isClearable
                          isSearchable
                        />
                      </div>
                    ) : (
                      <span
                        onClick={() => setEditingCell({ rowId: sale.id, field: 'product' })}
                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded"
                      >
                        {sale.product}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingCell?.rowId === sale.id && editingCell?.field === 'qty' ? (
                      <input
                        type="number"
                        value={sale.qty}
                        onChange={(e) => handleEditChange(sale.id, 'qty', Number(e.target.value))}
                        onBlur={() => setEditingCell(null)}
                        autoFocus
                        className="w-full px-2 py-1 border rounded text-sm bg-white dark:bg-gray-700"
                      />
                    ) : (
                      <span
                        onClick={() => setEditingCell({ rowId: sale.id, field: 'qty' })}
                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded"
                      >
                        {sale.qty}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingCell?.rowId === sale.id && editingCell?.field === 'price' ? (
                      <input
                        type="number"
                        step="0.01"
                        value={sale.price}
                        onChange={(e) => handleEditChange(sale.id, 'price', Number(e.target.value))}
                        onBlur={() => setEditingCell(null)}
                        autoFocus
                        className="w-full px-2 py-1 border rounded text-sm bg-white dark:bg-gray-700"
                      />
                    ) : (
                      <span
                        onClick={() => setEditingCell({ rowId: sale.id, field: 'price' })}
                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded"
                      >
                        {formatCurrency(sale.price)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {formatCurrency(sale.total)}
                  </TableCell>
                  <TableCell>
                    {editingCell?.rowId === sale.id && editingCell?.field === 'paid' ? (
                      <input
                        type="number"
                        step="0.01"
                        value={sale.paid}
                        onChange={(e) => handleEditChange(sale.id, 'paid', Number(e.target.value))}
                        onBlur={() => setEditingCell(null)}
                        autoFocus
                        className="w-full px-2 py-1 border rounded text-sm bg-white dark:bg-gray-700"
                      />
                    ) : (
                      <span
                        onClick={() => setEditingCell({ rowId: sale.id, field: 'paid' })}
                        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded"
                      >
                        {formatCurrency(sale.paid)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold text-red-600 dark:text-red-400">
                    {formatCurrency(sale.incoming)}
                  </TableCell>
                  <TableCell>
                    <span className={cn("px-2 py-1 rounded-full text-xs", statusColors[sale.payment_status])}>
                      {sale.payment_status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this sale?')) {
                          handleDeleteSelected();
                          setSelectedRows([sale.id]);
                        }
                      }}
                      size="sm"
                      variant="destructive"
                      className="bg-red-600 hover:bg-red-700"
                    >
                      🗑️
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredSales.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No sales data found for the selected month.</p>
            <Button
              onClick={() => setAddingNew(true)}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
            >
              Add First Sale
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EnhancedSalesTable;