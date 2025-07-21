import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import MonthYearPicker from './MonthYearPicker';
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

const SalesTable: React.FC = () => {
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

  const handleEditChange = async (id: string, field: keyof Sale, value: any) => {
    const updatedSales = sales.map((sale) =>
      sale.id === id ? { ...sale, [field]: value } : sale
    );
    setSales(updatedSales);

    const { error } = await supabase.from('sales').update({ [field]: value }).eq('id', id);
    if (error) {
      console.error('Update failed:', error.message);
    }
  };

  const handleRowSelect = (id: string) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const deleteSelectedRows = async () => {
    if (selectedRows.length === 0) return;

    const { error } = await supabase.from('sales').delete().in('id', selectedRows);
    if (error) {
      alert('Delete failed: ' + error.message);
    } else {
      setSales(sales.filter((s) => !selectedRows.includes(s.id)));
      setSelectedRows([]);
    }
  };

  const renderEditableCell = (
    sale: Sale,
    field: keyof Sale,
    formatter?: (value: any) => string,
    isCurrency = false,
    type = 'text'
  ) => {
    const isEditing = editingCell?.rowId === sale.id && editingCell.field === field;
    const rawValue = sale[field];
    const displayValue = formatter ? formatter(rawValue) : rawValue;

    const resellerOptions = resellers.map((r: any) => ({ label: r.name, value: r.name }));
    const productOptionsForCell = products.map((p: any) => ({ 
      label: p.name || p.product_name || p.product || 'Unnamed Product', 
      value: p.name || p.product_name || p.product || 'Unnamed Product' 
    }));

    if (field === 'member' || field === 'product') {
      const options = field === 'member' ? resellerOptions : productOptionsForCell;
      return (
        <TableCell>
          {isEditing ? (
            <Select
              options={options}
              value={options.find((o) => o.value === rawValue) || null}
              onChange={(selected) => {
                handleEditChange(sale.id, field, selected?.value);
                // If product is changed, update price automatically
                if (field === 'product' && selected?.value) {
                  const productPrice = getProductPrice(selected.value);
                  if (productPrice > 0) {
                    handleEditChange(sale.id, 'price', productPrice);
                  }
                }
              }}
              onBlur={() => setEditingCell(null)}
              isClearable
              isSearchable
              autoFocus
              styles={getSelectStyles(isDarkMode)}
            />
          ) : (
            <div onClick={() => setEditingCell({ rowId: sale.id, field })} className="cursor-pointer">
              {String(rawValue ?? '')}
            </div>
          )}
        </TableCell>
      );
    }

    if (field === 'payment_status') {
      return (
        <TableCell onClick={() => setEditingCell({ rowId: sale.id, field })} className="cursor-pointer">
          {isEditing ? (
            <select
              className="w-32 px-2 py-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              value={sale.payment_status}
              onChange={(e) => handleEditChange(sale.id, field, e.target.value)}
              onBlur={() => setEditingCell(null)}
              autoFocus
            >
              <option value="Fully Paid">Fully Paid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Pending">Pending</option>
            </select>
          ) : (
            <span className={cn(statusColors[sale.payment_status])}>{sale.payment_status}</span>
          )}
        </TableCell>
      );
    }

    return (
      <TableCell onClick={() => setEditingCell({ rowId: sale.id, field })} className="cursor-pointer">
        {isEditing ? (
          <input
            type={type}
            className="w-24 px-2 py-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            value={rawValue ?? ''}
            onChange={(e) =>
              handleEditChange(
                sale.id,
                field,
                type === 'number' ? Number(e.target.value) : e.target.value
              )
            }
            onBlur={() => setEditingCell(null)}
            autoFocus
          />
        ) : isCurrency ? (
          formatCurrency(Number(rawValue))
        ) : (
          String(rawValue ?? '')
        )}
      </TableCell>
    );
  };

  // Enhanced handleNewChange to auto-populate price when product is selected
  const handleNewChange = (field: keyof Sale, value: any) => {
    setNewSale((prev) => {
      const updated = { ...prev, [field]: value };
      
      // Auto-populate price when product is selected
      if (field === 'product' && value) {
        const productPrice = getProductPrice(value);
        if (productPrice > 0) {
          updated.price = productPrice;
        }
      }
      
      return updated;
    });
  };

  useEffect(() => {
    const qty = newSale.qty || 0;
    const price = newSale.price || 0;
    const paid = newSale.paid || 0;
    const total = qty * price;
    const incoming = total - paid;
    const balance = incoming;
    const payment_status = paid === total ? 'Fully Paid' : paid === 0 ? 'Pending' : 'Partially Paid';

    setNewSale((prev) => ({
      ...prev,
      total,
      incoming,
      balance,
      payment_status,
    }));
  }, [newSale.qty, newSale.price, newSale.paid]);

  const handleAddNew = async () => {
    // Only check the fields that user actually needs to fill
    const requiredFields: (keyof Sale)[] = [
      'date', 'member', 'product', 'qty', 'price', 'description'
    ];

    const allFilled = requiredFields.every(
      (field) => newSale[field] !== undefined && newSale[field] !== '' && newSale[field] !== 0
    );

    if (!allFilled) {
      const missingFields = requiredFields.filter(
        (field) => !newSale[field] || newSale[field] === '' || newSale[field] === 0
      );
      alert(`Please fill all required fields: ${missingFields.join(', ')}`);
      return;
    }

    // Prepare the complete record with calculated values
    const completeRecord = {
      ...newSale,
      type: newSale.type || 'sale', // Default type if not specified
      total: newSale.total || 0,
      paid: newSale.paid || 0,
      incoming: newSale.incoming || 0,
      balance: newSale.balance || 0,
      payment_status: newSale.payment_status || 'Pending'
    };

    const { data, error } = await supabase.from('sales').insert([completeRecord]).select();

    if (error) {
      alert('Insert failed: ' + error.message);
    } else if (data && data.length > 0) {
      setSales([data[0], ...sales]);
      setNewSale({});
      setAddingNew(false);
    }
  };

  const filteredSales = sales.filter((s) => {
    const matchMember = !filterMember || s.member === filterMember;
    const matchProduct = !filterProduct || s.product === filterProduct;
    return matchMember && matchProduct;
  });

  const computedSales = filteredSales.map((sale, index) => {
    const cumulativePaid = filteredSales
      .slice(0, index + 1)
      .reduce((sum, s) => sum + (s.paid || 0), 0);
    return { ...sale, cumulativePaid };
  });

  const handleExportToExcel = () => {
    if (!sales || sales.length === 0) {
      alert("No sales data to export.");
      return;
    }

    const exportData = sales.map((s) => ({
      Date: s.date,
      Member: s.member,
      Product: s.product,
      Quantity: s.qty,
      'Price per Pack': s.price,
      'Total Amount': s.total,
      Paid: s.paid,
      Incoming: s.incoming,
      'Total Balance': sales
        .slice(0, sales.findIndex((row) => row.id === s.id) + 1)
        .reduce((sum, row) => sum + row.paid, 0),
      Description: s.description,
      'Payment Status': s.payment_status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Sales");

    const month = new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'short' });
    const fileName = `Sales_${month}_${selectedYear}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  };

  const resellerOptions = resellers.map((r: any) => ({ label: r.name, value: r.name }));
  const productOptionsForFilter = products.map((p: any) => ({
    label: p.name || p.product_name || p.product || 'Unnamed Product',
    value: p.name || p.product_name || p.product || 'Unnamed Product',
  }));

  return (
    <Card>
      <CardHeader>
        <div className="space-y-4">
          {/* 🔹 Top Bar: Title + Buttons */}
          <div className="flex justify-between items-center w-full flex-wrap gap-4">
            <CardTitle>Sales Table</CardTitle>

            <div className="flex gap-2">
              {!addingNew ? (
                <Button onClick={() => setAddingNew(true)}>✚ Add</Button>
              ) : (
                <>
                  <Button onClick={handleAddNew} className="bg-green-600 text-white">✅ Save Record</Button>
                  <Button onClick={() => setAddingNew(false)} variant="outline">❌ Cancel</Button>
                </>
              )}
              <Button onClick={deleteSelectedRows} className="bg-red-500 text-white">🗑 Delete</Button>
              <Button onClick={handleExportToExcel} className="bg-green-500 text-white" variant="outline">📤 Export</Button>
            </div>
          </div>

          {/* 🔹 Filter Bar: Month + Smart Filters */}
          <div className="flex flex-wrap justify-between items-center w-full gap-4">
            {/* Month-Year Picker */}
            <MonthYearPicker
              onSelect={(month, year) => {
                setSelectedMonth(month);
                setSelectedYear(year);
              }}
            />

            {/* Member + Product Filters */}
            <div className="flex gap-4">
              <div className="w-48">
                <Select
                  options={resellerOptions}
                  value={filterMember ? { label: filterMember, value: filterMember } : null}
                  onChange={(selected) => setFilterMember(selected?.value || null)}
                  isClearable
                  isSearchable
                  placeholder="Filter by Member"
                  styles={getSelectStyles(isDarkMode)}
                />
              </div>
              <div className="w-48">
                <Select
                  options={productOptionsForFilter}
                  value={filterProduct ? { label: filterProduct, value: filterProduct } : null}
                  onChange={(selected) => setFilterProduct(selected?.value || null)}
                  isClearable
                  isSearchable
                  placeholder="Filter by Product"
                  styles={getSelectStyles(isDarkMode)}
                />
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Price Per Pack</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Incoming</TableHead>
                <TableHead>Total Balance</TableHead>
                <TableHead>Transaction Description</TableHead>
                <TableHead>Payment Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addingNew && (
                <TableRow className="bg-blue-100 dark:bg-blue-900/30">
                  <TableCell></TableCell>
                  <TableCell>
                    <input 
                      type="date" 
                      className="w-32 px-2 py-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent" 
                      value={newSale.date ?? ''} 
                      onChange={(e) => handleNewChange('date', e.target.value)} 
                    />
                  </TableCell>
                  <TableCell className="min-w-[140px]">
                    <Select
                      options={resellerOptions}
                      onChange={(selected) => handleNewChange('member', selected?.value)}
                      value={newSale.member ? { label: newSale.member, value: newSale.member } : null}
                      placeholder="Select Member"
                      isClearable
                      isSearchable
                      styles={getSelectStyles(isDarkMode)}
                    />
                  </TableCell>
                  <TableCell className="min-w-[140px]">
                    <Select
                      options={productOptionsForFilter}
                      value={productOptionsForFilter.find((option) => option.value === newSale.product) || null}
                      onChange={(selected) => handleNewChange("product", selected?.value || "")}
                      isClearable
                      isSearchable
                      placeholder="Select Product"
                      styles={getSelectStyles(isDarkMode)}
                    />
                  </TableCell>
                  <TableCell>
                    <input 
                      type="number" 
                      className="w-16 px-2 py-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent" 
                      value={newSale.qty ?? ''} 
                      onChange={(e) => handleNewChange('qty', Number(e.target.value))} 
                    />
                  </TableCell>
                  <TableCell>
                    <input 
                      type="number" 
                      className="w-20 px-2 py-1 border rounded bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" 
                      value={newSale.price ?? ''} 
                      onChange={(e) => handleNewChange('price', Number(e.target.value))}
                      title="Price auto-fills when product is selected"
                    />
                  </TableCell>
                  <TableCell>
                    <input 
                      type="number" 
                      className="w-20 px-2 py-1 border rounded bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" 
                      value={newSale.total ?? ''} 
                      readOnly 
                    />
                  </TableCell>
                  <TableCell>
                    <input 
                      type="number" 
                      className="w-20 px-2 py-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent" 
                      value={newSale.paid ?? ''} 
                      onChange={(e) => handleNewChange('paid', Number(e.target.value))} 
                    />
                  </TableCell>
                  <TableCell>
                    <input 
                      type="number" 
                      className="w-20 px-2 py-1 border rounded bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" 
                      value={newSale.incoming ?? ''} 
                      readOnly 
                    />
                  </TableCell>
                  <TableCell>
                    <input 
                      type="number" 
                      className="w-20 px-2 py-1 border rounded bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" 
                      value={newSale.balance ?? ''} 
                      readOnly 
                    />
                  </TableCell>
                  <TableCell>
                    <input 
                      type="text" 
                      className="w-32 px-2 py-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent" 
                      value={newSale.description ?? ''} 
                      onChange={(e) => handleNewChange('description', e.target.value)} 
                    />
                  </TableCell>
                  <TableCell>
                    <select 
                      className="w-32 px-2 py-1 border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400" 
                      value={newSale.payment_status ?? 'Pending'} 
                      onChange={(e) => handleNewChange('payment_status', e.target.value)}
                    >
                      <option value="Fully Paid">Fully Paid</option>
                      <option value="Partially Paid">Partially Paid</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </TableCell>
                </TableRow>
              )}
              {computedSales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedRows.includes(sale.id)}
                      onChange={() => handleRowSelect(sale.id)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 dark:focus:ring-offset-gray-800"
                    />
                  </TableCell>
                  {renderEditableCell(sale, 'date', undefined, false, 'date')}
                  {renderEditableCell(sale, 'member')}
                  {renderEditableCell(sale, 'product')}
                  {renderEditableCell(sale, 'qty', undefined, false, 'number')}
                  {renderEditableCell(sale, 'price', formatCurrency, true, 'number')}
                  {renderEditableCell(sale, 'total', formatCurrency, true, 'number')}
                  {renderEditableCell(sale, 'paid', formatCurrency, true, 'number')}
                  {renderEditableCell(sale, 'incoming', formatCurrency, true, 'number')}
                  <TableCell className="text-right font-semibold text-green-700 dark:text-green-400">
                    {formatCurrency(sale.cumulativePaid)}
                  </TableCell>
                  {renderEditableCell(sale, 'description')}
                  {renderEditableCell(sale, 'payment_status')}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesTable;