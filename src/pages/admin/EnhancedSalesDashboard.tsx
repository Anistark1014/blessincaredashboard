import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, TrendingUp, TrendingDown, Package } from 'lucide-react';

// Updated interface to include transaction_type
interface Sale {
  total: number;
  paid: number;
  qty: number;
  outstanding: number;
  payment_status: 'Fully Paid' | 'Partially Paid' | 'Pending' | 'Partial Clearance' | 'Complete Clearance' | 'Due Cleared';
  transaction_type: 'Sale' | 'Clearance';
  products: {
    id: string;
    name: string;
    mrp: number | null;
  } | null;
  [key: string]: any;
}

interface DashboardProps {
  data: Sale[];
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);

const EnhancedSalesDashboard: React.FC<DashboardProps> = ({ data }) => {
  const stats = useMemo(() => {
    return data.reduce(
      (acc, sale) => {
        // Only count Sales for total sales value and GMV
        if (sale.transaction_type === 'Sale') {
          acc.totalSales += Number(sale.total || 0);
          acc.gmv += Number(sale.qty || 0) * Number(sale.products?.mrp || 0);
          
          // For revenue received, only count paid amount from Sales
          acc.totalPaid += Number(sale.paid || 0);
        }
        // Don't count Clearance transactions in revenue - they're just balance adjustments
        
        return acc;
      },
      {
        totalSales: 0,
        totalPaid: 0,
        gmv: 0,
      }
    );
  }, [data]);

  // Calculate outstanding balance from Sales only
  const totalBalanceDue = useMemo(() => {
    return data
      .filter(sale => sale.transaction_type === 'Sale')
      .reduce((total, sale) => total + Number(sale.outstanding || 0), 0);
  }, [data]);

  // Handle case where there's no data to show
  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-gray-500">
          No data available for the selected period.
        </CardContent>
      </Card>
    );
  }

  // Get counts for display
  const salesCount = data.filter(sale => sale.transaction_type === 'Sale').length;
  const clearanceCount = data.filter(sale => sale.transaction_type === 'Clearance').length;

  return (
    <div>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalSales)}</div>
              <p className="text-xs text-muted-foreground">
                From {salesCount} sale{salesCount !== 1 ? 's' : ''}
                {clearanceCount > 0 && ` + ${clearanceCount} clearance${clearanceCount !== 1 ? 's' : ''}`}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Revenue Received</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalPaid)}</div>
              <p className="text-xs text-muted-foreground">Cash flow from sales only</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(totalBalanceDue)}</div>
              <p className="text-xs text-muted-foreground">Amount yet to be collected</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Gross Merchandise Value</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.gmv)}</div>
              <p className="text-xs text-muted-foreground">Total value at MRP</p>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </div>
  );
};

export default EnhancedSalesDashboard;