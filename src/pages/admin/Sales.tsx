import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, TrendingUp, AlertCircle, Edit, Save, X, Settings } from 'lucide-react';
import ColumnManager from '@/components/admin/ColumnManager';

interface Request {
  id: string;
  reseller_id: string;
  products_ordered: any;
  total_amount: number;
  amount_paid: number;
  payment_status: string;
  request_date: string;
  status: string;
  reseller?: {
    company_name: string;
    email: string;
  };
  [key: string]: any; // For custom columns
}

interface EditingRow {
  id: string;
  amount_paid: number;
  payment_status: string;
  [key: string]: any; // For custom columns
}

interface Column {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select';
  editable: boolean;
  options?: string[];
}

const AdminSales: React.FC = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<EditingRow | null>(null);
  const [customColumns, setCustomColumns] = useState<Column[]>([]);
  const { toast } = useToast();

  // Default system columns
  const defaultColumns: Column[] = [
    { id: 'id', name: 'Request ID', type: 'text', editable: false },
    { id: 'company', name: 'Company', type: 'text', editable: false },
    { id: 'request_date', name: 'Request Date', type: 'date', editable: false },
    { id: 'products', name: 'Products', type: 'text', editable: false },
    { id: 'total_amount', name: 'Total Amount', type: 'number', editable: false },
    { id: 'amount_paid', name: 'Amount Paid', type: 'number', editable: true },
    { id: 'outstanding', name: 'Outstanding', type: 'number', editable: false },
    { id: 'payment_status', name: 'Payment Status', type: 'select', editable: true, options: ['Pending', 'Partially Paid', 'Fully Paid'] },
  ];

  const allColumns = [...defaultColumns, ...customColumns];

  useEffect(() => {
    fetchRequests();
    loadCustomColumns();

    // Set up real-time subscription
    const subscription = supabase
      .channel('requests_sales_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'requests' },
        (payload) => {
          console.log('Request change received!', payload);
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [toast]);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('requests')
        .select(`
          *,
          users!inner(company_name, email)
        `);

      if (error) throw error;
      
      const formattedData = data?.map(request => ({
        ...request,
        reseller: {
          company_name: request.users?.company_name || 'Unknown',
          email: request.users?.email || 'Unknown'
        }
      })) || [];
      
      setRequests(formattedData as Request[]);
    } catch (error: any) {
      console.error('Error fetching requests:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sales data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCustomColumns = () => {
    const saved = localStorage.getItem('sales_custom_columns');
    if (saved) {
      try {
        setCustomColumns(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading custom columns:', error);
      }
    }
  };

  const saveCustomColumns = (columns: Column[]) => {
    setCustomColumns(columns);
    localStorage.setItem('sales_custom_columns', JSON.stringify(columns));
  };

  const handleEdit = (request: Request) => {
    const editData: EditingRow = {
      id: request.id,
      amount_paid: request.amount_paid || 0,
      payment_status: request.payment_status || 'Pending'
    };

    // Add custom column values
    customColumns.forEach(col => {
      editData[col.id] = request[col.id] || '';
    });

    setEditingRow(editData);
  };

  const handleSave = async () => {
    if (!editingRow) return;

    try {
      // Prepare update data - only system columns go to database
      const systemUpdate = {
        amount_paid: editingRow.amount_paid,
        payment_status: editingRow.payment_status
      };

      const { error } = await supabase
        .from('requests')
        .update(systemUpdate)
        .eq('id', editingRow.id);

      if (error) throw error;

      // Update custom column values in local state
      // Ensure editingRow is of type Request
      setRequests(prev =>
        prev.map(req => {
          if (req.id === editingRow.id) {
            const updated: Request = { ...req, ...systemUpdate };

            (customColumns as { id: keyof Request }[]).forEach(col => {
              const key = col.id;
              updated[key] = editingRow[key];
            });

            return updated;
          }
          return req;
        })
      );


      // Save custom data to localStorage
      const customData = JSON.parse(localStorage.getItem('sales_custom_data') || '{}');
      customData[editingRow.id] = {};
      customColumns.forEach(col => {
        customData[editingRow.id][col.id] = editingRow[col.id];
      });
      localStorage.setItem('sales_custom_data', JSON.stringify(customData));

      toast({
        title: "Success",
        description: "Sales record updated successfully",
      });

      setEditingRow(null);
    } catch (error: any) {
      console.error('Error updating sales record:', error);
      toast({
        title: "Error",
        description: "Failed to update sales record",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setEditingRow(null);
  };

  const updateEditingRow = (field: string, value: any) => {
    if (editingRow) {
      setEditingRow({ ...editingRow, [field]: value });
    }
  };

  const getCustomColumnValue = (request: Request, columnId: string) => {
    const customData = JSON.parse(localStorage.getItem('sales_custom_data') || '{}');
    return customData[request.id]?.[columnId] || '';
  };

  const renderCellContent = (request: Request, column: Column) => {
    const isEditing = editingRow?.id === request.id;
    
    if (!isEditing || !column.editable) {
      // Display mode
      switch (column.id) {
        case 'id':
          return <span className="font-mono text-sm">#{request.id.slice(0, 8)}</span>;
        case 'company':
          return request.reseller?.company_name;
        case 'request_date':
          return new Date(request.request_date).toLocaleDateString();
        case 'products':
          return (
            <div className="max-w-xs truncate">
              {Array.isArray(request.products_ordered) 
                ? request.products_ordered.map((p: any) => p.name || p.product_name).join(', ')
                : 'N/A'
              }
            </div>
          );
        case 'total_amount':
          return <span className="font-semibold">${Number(request.total_amount).toFixed(2)}</span>;
        case 'amount_paid':
          return <span>${Number(request.amount_paid).toFixed(2)}</span>;
        case 'outstanding':
          const outstanding = getOutstandingAmount(request);
          return (
            <span className={outstanding > 0 ? "text-red-600 font-semibold" : "text-green-600"}>
              ${outstanding.toFixed(2)}
            </span>
          );
        case 'payment_status':
          return getPaymentStatusBadge(request.payment_status || 'Pending', getOutstandingAmount(request));
        default:
          // Custom column
          return getCustomColumnValue(request, column.id) || '-';
      }
    } else {
      // Edit mode
      switch (column.id) {
        case 'amount_paid':
          return (
            <Input
              type="number"
              step="0.01"
              min="0"
              value={editingRow.amount_paid}
              onChange={(e) => updateEditingRow('amount_paid', Number(e.target.value))}
              className="w-24"
            />
          );
        case 'payment_status':
          return (
            <select
              value={editingRow.payment_status}
              onChange={(e) => updateEditingRow('payment_status', e.target.value)}
              className="px-2 py-1 border rounded text-sm"
            >
              {column.options?.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          );
        default:
          // Custom column editing
          if (column.type === 'select') {
            return (
              <select
                value={editingRow[column.id] || ''}
                onChange={(e) => updateEditingRow(column.id, e.target.value)}
                className="px-2 py-1 border rounded text-sm"
              >
                <option value="">Select...</option>
                {column.options?.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            );
          } else {
            return (
              <Input
                type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'}
                value={editingRow[column.id] || ''}
                onChange={(e) => updateEditingRow(column.id, e.target.value)}
                className="w-32"
              />
            );
          }
      }
    }
  };

  const getTotalRevenue = () => {
    return requests.reduce((sum, r) => sum + (Number(r.amount_paid) || 0), 0);
  };

  const getTotalOutstanding = () => {
    return requests.reduce((sum, r) => {
      const totalAmount = Number(r.total_amount) || 0;
      const amountPaid = Number(r.amount_paid) || 0;
      return sum + Math.max(0, totalAmount - amountPaid);
    }, 0);
  };

  const getOutstandingAmount = (request: Request) => {
    const totalAmount = Number(request.total_amount) || 0;
    const amountPaid = Number(request.amount_paid) || 0;
    return Math.max(0, totalAmount - amountPaid);
  };

  const getPaymentStatusBadge = (status: string, outstanding: number) => {
    if (outstanding === 0) {
      return <Badge className="bg-green-100 text-green-800">Fully Paid</Badge>;
    } else if (status === 'Partially Paid') {
      return <Badge className="bg-yellow-100 text-yellow-800">Partially Paid</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">Sales Management</h1>
      </div>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList>
          <TabsTrigger value="sales">Sales Data</TabsTrigger>
          <TabsTrigger value="columns" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Manage Columns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${getTotalRevenue().toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Amount received</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outstanding Amount</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">${getTotalOutstanding().toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Amount pending</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{requests.length}</div>
                <p className="text-xs text-muted-foreground">All time orders</p>
              </CardContent>
            </Card>
          </div>

          {/* Sales Table */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {allColumns.map((column) => (
                        <TableHead key={column.id}>{column.name}</TableHead>
                      ))}
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => {
                      const isEditing = editingRow?.id === request.id;
                      
                      return (
                        <TableRow key={request.id}>
                          {allColumns.map((column) => (
                            <TableCell key={column.id}>
                              {renderCellContent(request, column)}
                            </TableCell>
                          ))}
                          <TableCell>
                            {isEditing ? (
                              <div className="flex space-x-2">
                                <Button size="sm" onClick={handleSave}>
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={handleCancel}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => handleEdit(request)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {requests.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={allColumns.length + 1} className="text-center py-8">
                          <p className="text-muted-foreground">No sales records found</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="columns">
          <ColumnManager 
            columns={allColumns} 
            onColumnsChange={(columns) => {
              const customCols = columns.filter(col => !defaultColumns.find(dc => dc.id === col.id));
              saveCustomColumns(customCols);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSales;