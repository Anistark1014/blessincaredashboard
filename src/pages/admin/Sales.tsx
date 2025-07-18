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

  const handleAddNew = async () => {
    if (
      newSale.date &&
      newSale.type &&
      newSale.member &&
      newSale.brand &&
      newSale.qty !== undefined &&
      newSale.price !== undefined &&
      newSale.total !== undefined &&
      newSale.paid !== undefined &&
      newSale.incoming !== undefined &&
      newSale.balance !== undefined &&
      newSale.description &&
      newSale.payment_status
    ) {
      const { data, error } = await supabase.from('sales').insert([newSale]).select();

      if (error) {
        alert('Insert failed: ' + error.message);
      } else if (data) {
        setSales((prev) => [...prev, data[0] as Sale]);
        setNewSale({});
        setAddingNew(false);
      }
    } else {
      alert('Please fill all required fields before saving.');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center w-full">
          <CardTitle>Sales Table</CardTitle>
          <MonthYearPicker onSelect={(month, year) => {
  setSelectedMonth(month);
  setSelectedYear(year);
}} />

          {!addingNew ? (
            <Button onClick={() => setAddingNew(true)}>+ Add New Record</Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={handleAddNew} className="bg-green-600 text-white">
                ✅ Save Record
              </Button>
              <Button onClick={() => setAddingNew(false)} variant="outline">
                ❌ Cancel
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
       <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Members</TableHead>
                            <TableHead>Brand</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead>Price Per Pack</TableHead>
                            <TableHead>Total Amount</TableHead>
                            <TableHead>Paid</TableHead>
                            <TableHead>Incoming</TableHead>
                            <TableHead>Clearance Date</TableHead>
                            <TableHead>Total Balance</TableHead>
                            <TableHead>Transaction Description</TableHead>
                            <TableHead>Payment Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sales.map((sale) => (
                            <TableRow key={sale.id}>
                              {renderEditableCell(sale, 'date', undefined, false, 'date')}
                              {renderEditableCell(sale, 'type')}
                              {renderEditableCell(sale, 'member')}
                              {renderEditableCell(sale, 'brand')}
                              {renderEditableCell(sale, 'qty', undefined, false, 'number')}
                              {renderEditableCell(sale, 'price', formatCurrency, true, 'number')}
                              {renderEditableCell(sale, 'total', formatCurrency, true, 'number')}
                              {renderEditableCell(sale, 'paid', formatCurrency, true, 'number')}
                              {renderEditableCell(sale, 'incoming', formatCurrency, true, 'number')}
                              {renderEditableCell(sale, 'clearance', undefined, false, 'date')}
                              {renderEditableCell(sale, 'balance', formatCurrency, true, 'number')}
                              {renderEditableCell(sale, 'description')}
                              {renderEditableCell(sale, 'payment_status')}
                            </TableRow>
                          ))}
                          {addingNew && (
                            <TableRow className="bg-blue-100">
                              <TableCell>
                                <input
                                  type="date"
                                  className="w-32 px-2 py-1 border rounded"
                                  value={newSale.date ?? ''}
                                  onChange={(e) => handleNewChange('date', e.target.value)}
                                />
                              </TableCell>
                              <TableCell>
                                <input
                                  type="text"
                                  className="w-24 px-2 py-1 border rounded"
                                  value={newSale.type ?? ''}
                                  onChange={(e) => handleNewChange('type', e.target.value)}
                                />
                              </TableCell>
                              <TableCell>
                                <input
                                  type="text"
                                  className="w-24 px-2 py-1 border rounded"
                                  value={newSale.member ?? ''}
                                  onChange={(e) => handleNewChange('member', e.target.value)}
                                />
                              </TableCell>
                              <TableCell>
                                <input
                                  type="text"
                                  className="w-24 px-2 py-1 border rounded"
                                  value={newSale.brand ?? ''}
                                  onChange={(e) => handleNewChange('brand', e.target.value)}
                                />
                              </TableCell>
                              <TableCell>
                                <input
                                  type="number"
                                  className="w-16 px-2 py-1 border rounded"
                                  value={newSale.qty ?? ''}
                                  onChange={(e) => handleNewChange('qty', Number(e.target.value))}
                                />
                              </TableCell>
                              <TableCell>
                                <input
                                  type="number"
                                  className="w-20 px-2 py-1 border rounded"
                                  value={newSale.price ?? ''}
                                  onChange={(e) => handleNewChange('price', Number(e.target.value))}
                                />
                              </TableCell>
                              <TableCell>
                                <input
                                  type="number"
                                  className="w-20 px-2 py-1 border rounded"
                                  value={newSale.total ?? ''}
                                  onChange={(e) => handleNewChange('total', Number(e.target.value))}
                                />
                              </TableCell>
                              <TableCell>
                                <input
                                  type="number"
                                  className="w-20 px-2 py-1 border rounded"
                                  value={newSale.paid ?? ''}
                                  onChange={(e) => handleNewChange('paid', Number(e.target.value))}
                                />
                              </TableCell>
                              <TableCell>
                                <input
                                  type="number"
                                  className="w-20 px-2 py-1 border rounded"
                                  value={newSale.incoming ?? ''}
                                  onChange={(e) => handleNewChange('incoming', Number(e.target.value))}
                                />
                              </TableCell>
                              <TableCell>
                                <input
                                  type="date"
                                  className="w-32 px-2 py-1 border rounded"
                                  value={newSale.clearance ?? ''}
                                  onChange={(e) => handleNewChange('clearance', e.target.value)}
                                />
                              </TableCell>
                              <TableCell>
                                <input
                                  type="number"
                                  className="w-20 px-2 py-1 border rounded"
                                  value={newSale.balance ?? ''}
                                  onChange={(e) => handleNewChange('balance', Number(e.target.value))}
                                />
                              </TableCell>
                              <TableCell>
                                <input
                                  type="text"
                                  className="w-32 px-2 py-1 border rounded"
                                  value={newSale.description ?? ''}
                                  onChange={(e) => handleNewChange('description', e.target.value)}
                                />
                              </TableCell>
                              <TableCell>
                                <select
                                  className="w-32 px-2 py-1 border rounded"
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
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
    </Card>
  );
};

export default SalesTable;
