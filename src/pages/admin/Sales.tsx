import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import MonthYearPicker from './MonthYearPicker';

interface Sale {
  id: string;
  date: string;
  type: string;
  member: string;
  brand: string;
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

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);

const statusColors = {
  'Fully Paid': 'text-green-700 font-semibold',
  'Partially Paid': 'text-yellow-600 font-semibold',
  'Pending': 'text-red-600 font-semibold',
};

const SalesTable: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: keyof Sale } | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newSale, setNewSale] = useState<Partial<Sale>>({});
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

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

  useEffect(() => {
    fetchSales();
  }, [selectedMonth, selectedYear]);

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

    if (field === 'payment_status') {
      return (
        <TableCell onClick={() => setEditingCell({ rowId: sale.id, field })} className="cursor-pointer">
          {isEditing ? (
            <select
              className="w-32 px-2 py-1 border rounded"
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
            className="w-24 px-2 py-1 border rounded"
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

  const handleNewChange = (field: keyof Sale, value: any) => {
    setNewSale((prev) => ({ ...prev, [field]: value }));
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
    const requiredFields: (keyof Sale)[] = [
      'date', 'type', 'member', 'brand', 'qty', 'price', 'total',
      'paid', 'incoming', 'balance', 'description', 'payment_status',
    ];

    const allFilled = requiredFields.every(
      (field) => newSale[field] !== undefined && newSale[field] !== ''
    );

    if (!allFilled) {
      alert('Please fill all required fields before saving.');
      return;
    }

    const { data, error } = await supabase.from('sales').insert([newSale]).select();

    if (error) {
      alert('Insert failed: ' + error.message);
    } else if (data && data.length > 0) {
      setSales([data[0], ...sales]);
      setNewSale({});
      setAddingNew(false);
    }
  };

  const computedSales = sales.map((sale, index) => {
    const cumulativePaid = sales.slice(0, index + 1).reduce((sum, s) => sum + (s.paid || 0), 0);
    return { ...sale, cumulativePaid };
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center w-full">
          <CardTitle>Sales Table</CardTitle>
          <MonthYearPicker onSelect={(month, year) => {
            setSelectedMonth(month);
            setSelectedYear(year);
          }} />
          <div className="flex gap-2">
            {!addingNew ? (
              <Button onClick={() => setAddingNew(true)}>+ Add New Record</Button>
            ) : (
              <>
                <Button onClick={handleAddNew} className="bg-green-600 text-white">✅ Save Record</Button>
                <Button onClick={() => setAddingNew(false)} variant="outline">❌ Cancel</Button>
              </>
            )}
            <Button onClick={deleteSelectedRows} className="bg-red-500 text-white">🗑 Delete Selected</Button>
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
                <TableHead>Brand</TableHead>
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
                <TableRow className="bg-blue-100">
                  <TableCell></TableCell>
                  <TableCell><input type="date" className="w-32 px-2 py-1 border rounded" value={newSale.date ?? ''} onChange={(e) => handleNewChange('date', e.target.value)} /></TableCell>
                  <TableCell><input type="text" className="w-24 px-2 py-1 border rounded" value={newSale.member ?? ''} onChange={(e) => handleNewChange('member', e.target.value)} /></TableCell>
                  <TableCell><input type="text" className="w-24 px-2 py-1 border rounded" value={newSale.brand ?? ''} onChange={(e) => handleNewChange('brand', e.target.value)} /></TableCell>
                  <TableCell><input type="number" className="w-16 px-2 py-1 border rounded" value={newSale.qty ?? ''} onChange={(e) => handleNewChange('qty', Number(e.target.value))} /></TableCell>
                  <TableCell><input type="number" className="w-20 px-2 py-1 border rounded" value={newSale.price ?? ''} onChange={(e) => handleNewChange('price', Number(e.target.value))} /></TableCell>
                  <TableCell><input type="number" className="w-20 px-2 py-1 border rounded bg-gray-100" value={newSale.total ?? ''} readOnly /></TableCell>
                  <TableCell><input type="number" className="w-20 px-2 py-1 border rounded" value={newSale.paid ?? ''} onChange={(e) => handleNewChange('paid', Number(e.target.value))} /></TableCell>
                  <TableCell><input type="number" className="w-20 px-2 py-1 border rounded bg-gray-100" value={newSale.incoming ?? ''} readOnly /></TableCell>
                  <TableCell><input type="number" className="w-20 px-2 py-1 border rounded bg-gray-100" value={newSale.balance ?? ''} readOnly /></TableCell>
                  <TableCell><input type="text" className="w-32 px-2 py-1 border rounded" value={newSale.description ?? ''} onChange={(e) => handleNewChange('description', e.target.value)} /></TableCell>
                  <TableCell>
                    <select className="w-32 px-2 py-1 border rounded" value={newSale.payment_status ?? 'Pending'} onChange={(e) => handleNewChange('payment_status', e.target.value)}>
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
                    />
                  </TableCell>
                  {renderEditableCell(sale, 'date', undefined, false, 'date')}
                  {renderEditableCell(sale, 'member')}
                  {renderEditableCell(sale, 'brand')}
                  {renderEditableCell(sale, 'qty', undefined, false, 'number')}
                  {renderEditableCell(sale, 'price', formatCurrency, true, 'number')}
                  {renderEditableCell(sale, 'total', formatCurrency, true, 'number')}
                  {renderEditableCell(sale, 'paid', formatCurrency, true, 'number')}
                  {renderEditableCell(sale, 'incoming', formatCurrency, true, 'number')}
                  <TableCell className="text-right font-semibold text-green-700">
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
