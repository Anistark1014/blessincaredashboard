import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { addDays, format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import * as XLSX from 'xlsx';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent, 
  Calendar as CalendarIcon,
  Download,
  Search,
  Package
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";

// Interfaces
interface Product {
  id: string;
  name: string;
  mrp: number | null;
  cost_price: number | null;
}

interface Sale {
  id: string;
  date: string;
  qty: number;
  price: number;
  total: number;
  product_id: string;
  transaction_type: 'Sale' | 'Clearance';
  products: Product | null;
  users: { name: string } | null;
}

interface GrossProfitData {
  saleId: string;
  date: string;
  customerName: string;
  productName: string;
  quantity: number;
  salePrice: number;
  costPrice: number | null;
  revenue: number;
  totalCost: number | null;
  grossProfit: number | null;
  grossProfitMargin: number | null;
}

interface ProductProfitSummary {
  productId: string;
  productName: string;
  totalQuantitySold: number;
  totalRevenue: number;
  totalCost: number | null;
  totalGrossProfit: number | null;
  averageMargin: number | null;
  salesCount: number;
}

const GrossProfitAnalysis: React.FC = () => {
  const { toast } = useToast();
  
  // State
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: addDays(new Date(), 0),
  });
  const [isPopoverOpen, setPopoverOpen] = useState(false);

  // Helper functions
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);

  const calculateGrossProfit = (salePrice: number, costPrice: number | null, quantity: number): number | null => {
    if (costPrice === null || costPrice === undefined) return null;
    return (salePrice - costPrice) * quantity;
  };

  const calculateGrossProfitMargin = (salePrice: number, costPrice: number | null): number | null => {
    if (costPrice === null || costPrice === undefined || salePrice === 0) return null;
    return ((salePrice - costPrice) / salePrice) * 100;
  };

  // Fetch sales data
  const fetchSalesData = async () => {
    if (!date?.from || !date?.to) return;

    setLoading(true);
    try {
      const startDate = date.from.toISOString();
      const endDate = date.to.toISOString();

      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          date,
          qty,
          price,
          total,
          product_id,
          transaction_type,
          products!inner(id, name, mrp, cost_price),
          users(name)
        `)
        .eq('transaction_type', 'Sale') // Only get sales, not clearances
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) throw error;

      setSales(data || []);
    } catch (error: any) {
      console.error('Error fetching sales:', error);
      toast({
        title: "Fetch Error",
        description: "Error fetching data: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesData();
  }, [date]);

  // Calculate gross profit data
  const grossProfitData = useMemo((): GrossProfitData[] => {
    return sales
      .filter(sale => sale.products?.cost_price !== null) // Only include sales with cost data
      .map(sale => {
        const costPrice = sale.products?.cost_price || 0;
        const revenue = sale.total;
        const totalCost = costPrice * sale.qty;
        const grossProfit = calculateGrossProfit(sale.price, costPrice, sale.qty);
        const grossProfitMargin = calculateGrossProfitMargin(sale.price, costPrice);

        return {
          saleId: sale.id,
          date: sale.date,
          customerName: sale.users?.name || 'Unknown',
          productName: sale.products?.name || 'Unknown',
          quantity: sale.qty,
          salePrice: sale.price,
          costPrice,
          revenue,
          totalCost,
          grossProfit,
          grossProfitMargin,
        };
      })
      .filter(data => searchTerm === '' || 
        data.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        data.customerName.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [sales, searchTerm]);

  // Calculate product-wise profit summary
  const productProfitSummary = useMemo((): ProductProfitSummary[] => {
    const productMap = new Map<string, ProductProfitSummary>();

    grossProfitData.forEach(data => {
      const productId = data.saleId; // Using sale product info
      const existing = productMap.get(data.productName) || {
        productId: data.productName,
        productName: data.productName,
        totalQuantitySold: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalGrossProfit: 0,
        averageMargin: 0,
        salesCount: 0,
      };

      existing.totalQuantitySold += data.quantity;
      existing.totalRevenue += data.revenue;
      existing.totalCost += data.totalCost || 0;
      existing.totalGrossProfit += data.grossProfit || 0;
      existing.salesCount += 1;

      productMap.set(data.productName, existing);
    });

    // Calculate average margins
    return Array.from(productMap.values()).map(product => ({
      ...product,
      averageMargin: product.totalRevenue > 0 ? 
        ((product.totalRevenue - product.totalCost) / product.totalRevenue) * 100 : 0
    }));
  }, [grossProfitData]);

  // Overall statistics
  const overallStats = useMemo(() => {
    const totalRevenue = grossProfitData.reduce((sum, data) => sum + data.revenue, 0);
    const totalCost = grossProfitData.reduce((sum, data) => sum + (data.totalCost || 0), 0);
    const totalGrossProfit = grossProfitData.reduce((sum, data) => sum + (data.grossProfit || 0), 0);
    const salesWithCostData = grossProfitData.length;
    const totalSales = sales.length;
    const averageMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalCost,
      totalGrossProfit,
      averageMargin,
      salesWithCostData,
      totalSales,
      salesWithoutCostData: totalSales - salesWithCostData,
    };
  }, [grossProfitData, sales]);

  // Export functions
  const exportDetailedReport = () => {
    const exportData = grossProfitData.map(data => ({
      Date: new Date(data.date).toLocaleDateString(),
      Customer: data.customerName,
      Product: data.productName,
      Quantity: data.quantity,
      'Sale Price': data.salePrice,
      'Cost Price': data.costPrice,
      Revenue: data.revenue,
      'Total Cost': data.totalCost,
      'Gross Profit': data.grossProfit,
      'Gross Profit Margin %': data.grossProfitMargin?.toFixed(2),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Detailed Gross Profit");
    XLSX.writeFile(workbook, `Gross_Profit_Detailed_Report.xlsx`);
  };

  const exportProductSummary = () => {
    const exportData = productProfitSummary.map(product => ({
      Product: product.productName,
      'Total Quantity Sold': product.totalQuantitySold,
      'Total Revenue': product.totalRevenue,
      'Total Cost': product.totalCost,
      'Total Gross Profit': product.totalGrossProfit,
      'Average Margin %': product.averageMargin?.toFixed(2),
      'Number of Sales': product.salesCount,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Product Profit Summary");
    XLSX.writeFile(workbook, `Product_Profit_Summary.xlsx`);
  };

  const displayDate = useMemo(() => {
    if (!date?.from) return null;
    const fromMonth = format(date.from, "MMM");
    const fromYear = format(date.from, "yyyy");
    if (date.to && (format(date.from, 'yyyyMM') === format(date.to, 'yyyyMM'))) {
      return `${fromMonth.toUpperCase()} ${fromYear}`;
    }
    if (date.to) {
      const toMonth = format(date.to, "MMM");
      const toYear = format(date.to, "yyyy");
      if (fromYear === toYear) {
        return `${fromMonth.toUpperCase()} - ${toMonth.toUpperCase()} ${fromYear}`;
      }
      return `${fromMonth.toUpperCase()} ${fromYear} - ${toMonth.toUpperCase()} ${toYear}`;
    }
    return `${fromMonth.toUpperCase()} ${fromYear}`;
  }, [date]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Gross Profit Analysis</h1>
          {displayDate && (
            <div className="flex items-center gap-2 text-muted-foreground border rounded-lg px-3 py-1">
              <CalendarIcon className="h-4 w-4" />
              <span className="font-semibold">{displayDate}</span>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by product or customer..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Popover open={isPopoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[300px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from
                ? date.to
                  ? `${date.from.toLocaleDateString()} - ${date.to.toLocaleDateString()}`
                  : date.from.toLocaleDateString()
                : "Pick a date range"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex">
              <div className="flex flex-col space-y-1 p-2 border-r">
                <Button
                  variant="ghost"
                  onClick={() => {
                    const now = new Date();
                    setDate({
                      from: new Date(now.getFullYear(), now.getMonth(), 1),
                      to: new Date(),
                    });
                    setPopoverOpen(false);
                  }}
                >
                  This Month
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const now = new Date();
                    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
                    setDate({ from: lastMonth, to: lastMonthEnd });
                    setPopoverOpen(false);
                  }}
                >
                  Last Month
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDate({
                      from: new Date(new Date().getFullYear(), 0, 1),
                      to: new Date(),
                    });
                    setPopoverOpen(false);
                  }}
                >
                  This Year
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex gap-2">
          <Button onClick={exportDetailedReport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Details
          </Button>
          <Button onClick={exportProductSummary} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Summary
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Gross Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(overallStats.totalGrossProfit)}
            </div>
            <p className="text-xs text-muted-foreground">
              From {overallStats.salesWithCostData} sales with cost data
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average Margin</CardTitle>
            <Percent className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {overallStats.averageMargin.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Overall profit margin
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(overallStats.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              From sales with cost data
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cost Coverage</CardTitle>
            <Package className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {((overallStats.salesWithCostData / overallStats.totalSales) * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {overallStats.salesWithCostData} of {overallStats.totalSales} sales have cost data
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Product Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product Profit Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">Gross Profit</TableHead>
                  <TableHead className="text-right">Avg Margin %</TableHead>
                  <TableHead className="text-right">Sales Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productProfitSummary.map((product) => (
                  <TableRow key={product.productId}>
                    <TableCell className="font-medium">{product.productName}</TableCell>
                    <TableCell className="text-right">{product.totalQuantitySold}</TableCell>
                    <TableCell className="text-right">{formatCurrency(product.totalRevenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(product.totalCost || 0)}</TableCell>
                    <TableCell className="text-right">
                      <span className={product.totalGrossProfit! >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(product.totalGrossProfit || 0)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={product.averageMargin! >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {product.averageMargin?.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{product.salesCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Gross Profit Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Sale Price</TableHead>
                  <TableHead className="text-right">Cost Price</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">Gross Profit</TableHead>
                  <TableHead className="text-right">Margin %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grossProfitData.map((data) => (
                  <TableRow key={data.saleId}>
                    <TableCell>{new Date(data.date).toLocaleDateString()}</TableCell>
                    <TableCell>{data.customerName}</TableCell>
                    <TableCell>{data.productName}</TableCell>
                    <TableCell className="text-right">{data.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(data.salePrice)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(data.costPrice || 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(data.revenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(data.totalCost || 0)}</TableCell>
                    <TableCell className="text-right">
                      <span className={data.grossProfit! >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(data.grossProfit || 0)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={data.grossProfitMargin! >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {data.grossProfitMargin?.toFixed(1)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {overallStats.salesWithoutCostData > 0 && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <Package className="h-5 w-5" />
              <p>
                <strong>{overallStats.salesWithoutCostData}</strong> sales don't have cost price data and are excluded from this analysis.
                Update your products with cost prices to get complete profit insights.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GrossProfitAnalysis;