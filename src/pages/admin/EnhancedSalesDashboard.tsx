import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';

// Re-use the Sale type from your main page
interface Sale {
  total: number;
  paid: number;
  payment_status: 'Fully Paid' | 'Partially Paid' | 'Pending';
  [key: string]: any; // Allow other properties
}

// Props for our new component
interface DashboardProps {
  data: Sale[];
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);

// Define colors for the pie chart that match your status colors
const COLORS = {
  'Fully Paid': '#22c55e',     // Green
  'Partially Paid': '#f59e0b', // Yellow/Amber
  'Pending': '#ef4444',       // Red
};

const EnhancedSalesDashboard: React.FC<DashboardProps> = ({ data }) => {
  // useMemo will recalculate stats only when the `data` prop changes
  const stats = useMemo(() => {
    return data.reduce(
      (acc, sale) => {
        acc.totalSales += sale.total || 0;
        acc.totalPaid += sale.paid || 0;
        acc.statusCounts[sale.payment_status] = (acc.statusCounts[sale.payment_status] || 0) + 1;
        return acc;
      },
      {
        totalSales: 0,
        totalPaid: 0,
        statusCounts: {} as { [key: string]: number },
      }
    );
  }, [data]);

  const totalBalanceDue = stats.totalSales - stats.totalPaid;

  const pieChartData = Object.entries(stats.statusCounts).map(([name, value]) => ({
    name,
    value,
  }));

  // Handle case where there's no data to show
  if (data.length === 0) {
    return (
      <CardContent className="border-t pt-6 text-center text-gray-500">
        No data available for the selected period.
      </CardContent>
    );
  }

  return (
    <CardContent className="border-t pt-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Stats Section (Left Side) */}
        <div className="lg:col-span-2 space-y-6">
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
        </div>

        {/* Pie Chart Section (Right Side) */}
        <Card className="lg:col-span-3 flex flex-col">
          <CardHeader>
            <CardTitle>Payment Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={110}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} transaction(s)`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </CardContent>
  );
};

export default EnhancedSalesDashboard;