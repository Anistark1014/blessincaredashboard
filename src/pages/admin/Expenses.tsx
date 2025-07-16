
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, DollarSign, TrendingDown, Calculator, Edit, Save, X, Trash2 } from 'lucide-react';

interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  description: string;
}

interface EditingRow {
  id: string;
  category: string;
  amount: number;
  date: string;
  description: string;
}

const expenseCategories = [
  'Manufacturing',
  'Marketing',
  'Operations',
  'Research & Development',
  'Administrative',
  'Travel',
  'Equipment',
  'Utilities',
  'Legal',
  'Other'
];

const AdminExpenses: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<EditingRow | null>(null);
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });
  const { toast } = useToast();
  



  useEffect(() => {
    
    const fetchExpenses = async () => {
      
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .order('date', { ascending: false });

        if (error) throw error;
        setExpenses(data as Expense[]);
      } catch (error: any) {
        console.error('Error fetching expenses:', error);
        toast({
          title: "Error",
          description: "Failed to fetch expenses",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();

    // Set up real-time subscription
    const subscription = supabase
      .channel('expenses_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'expenses' },
        (payload) => {
          console.log('Expense change received!', payload);
          fetchExpenses();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.category || !formData.amount || !formData.date) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const {data: { user },error} = await supabase.auth.getUser();

      if (error || !user) {
        console.error("User not found or error occurred:", error);
        return;
      }

    try {
      const { error } = await supabase
        .from('expenses')
        .insert({
          user_id: user?.id,
          category: formData.category,
          amount: Number(formData.amount),
          date: formData.date,
          description: formData.description
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Expense added successfully",
      });

      setDialogOpen(false);
      setFormData({
        category: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
      });
    } catch (error: any) {
      console.error('Error adding expense:', error);
      toast({
        title: "Error",
        description: "Failed to add expense",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingRow({
      id: expense.id,
      category: expense.category,
      amount: expense.amount,
      date: expense.date,
      description: expense.description
    });
  };

  const handleSave = async () => {
    if (!editingRow) return;

    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          category: editingRow.category,
          amount: editingRow.amount,
          date: editingRow.date,
          description: editingRow.description
        })
        .eq('id', editingRow.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Expense updated successfully",
      });

      setEditingRow(null);
    } catch (error: any) {
      console.error('Error updating expense:', error);
      toast({
        title: "Error",
        description: "Failed to update expense",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Expense deleted successfully",
      });
    } catch (error: any) {
      console.error('Error deleting expense:', error);
      toast({
        title: "Error",
        description: "Failed to delete expense",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setEditingRow(null);
  };

  const getTotalExpenses = () => {
    return expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  };

  const getMonthlyExpenses = () => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return expenses
      .filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
      })
      .reduce((sum, expense) => sum + Number(expense.amount), 0);
  };

  const getAverageExpense = () => {
    if (expenses.length === 0) return 0;
    return getTotalExpenses() / expenses.length;
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
        <h1 className="text-3xl font-bold text-foreground">Expense Management</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Expense</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="">Select category</option>
                  {expenseCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Amount *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Date *</label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Enter expense description..."
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Expense</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${getTotalExpenses().toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${getMonthlyExpenses().toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Current month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Expense</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${getAverageExpense().toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Per expense</p>
          </CardContent>
        </Card>
      </div>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => {
                  const isEditing = editingRow?.id === expense.id;
                  
                  return (
                    <TableRow key={expense.id}>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="date"
                            value={editingRow.date}
                            onChange={(e) => setEditingRow({
                              ...editingRow,
                              date: e.target.value
                            })}
                          />
                        ) : (
                          new Date(expense.date).toLocaleDateString()
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <select
                            value={editingRow.category}
                            onChange={(e) => setEditingRow({
                              ...editingRow,
                              category: e.target.value
                            })}
                            className="px-2 py-1 border rounded text-sm w-full"
                          >
                            {expenseCategories.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        ) : (
                          expense.category
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editingRow.amount}
                            onChange={(e) => setEditingRow({
                              ...editingRow,
                              amount: Number(e.target.value)
                            })}
                            className="w-24"
                          />
                        ) : (
                          <span className="font-semibold">${Number(expense.amount).toFixed(2)}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editingRow.description}
                            onChange={(e) => setEditingRow({
                              ...editingRow,
                              description: e.target.value
                            })}
                          />
                        ) : (
                          expense.description || 'N/A'
                        )}
                      </TableCell>
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
                          <div className="flex space-x-2">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(expense)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleDelete(expense.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {expenses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <p className="text-muted-foreground">No expenses found</p>
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

export default AdminExpenses;