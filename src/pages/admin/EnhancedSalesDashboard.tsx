import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, TrendingUp, TrendingDown, Package } from 'lucide-react';

// **UPDATED**: This interface now accurately reflects the nested data structure
// passed from the main SalesTable component.
interface Sale {
  total: number;
  paid: number;
  qty: number;
  payment_status: 'Fully Paid' | 'Partially Paid' | 'Pending';
  products: {
    id: string;
    name: string;
    mrp: number | null;
    // other product properties can exist here
  } | null;
  [key: string]: any; // Allow other properties
}

// Props for our component
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
  // The stats calculation now correctly accesses product.mrp for GMV.
  const stats = useMemo(() => {
    return data.reduce(
      (acc, sale) => {
        acc.totalSales += Number(sale.total || 0);
        acc.totalPaid += Number(sale.paid || 0);
        // Calculate GMV: quantity * product's MRP
        acc.gmv += Number(sale.qty || 0) * Number(sale.products?.mrp || 0);
        return acc;
      },
      {
        totalSales: 0,
        totalPaid: 0,
        gmv: 0, // Initialize GMV
      }
    );
  }, [data]);

  const totalBalanceDue = stats.totalSales - stats.totalPaid;

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

  return (
    <Card>
      <CardContent className="pt-6">
        {/* **UPDATED**: The grid now takes the full width since the pie chart is removed. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalSales)}</div>
              <p className="text-xs text-muted-foreground">From {data.length} transactions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Revenue Received</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalPaid)}</div>
              <p className="text-xs text-muted-foreground">Cash flow for this period</p>
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
    </Card>
  );
};

export default EnhancedSalesDashboard;

