import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Tables } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {CalendarIcon } from 'lucide-react';

import "react-quill/dist/quill.snow.css";

// Recharts imports for the graph
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

// Date-fns for date manipulation
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

// Shadcn Popover and Calendar for date range picker
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

type Product = Tables<'products'>;
type Sales = Tables<'sales'>; // Added for the sales data


// Helper type for combined sales data points
interface SalesDataPoint {
    date: string;
    qty?: number;
    price?: number;
    total?: number;
    [key: string]: any; // For dynamic product lines
}

// Data for KPIs
interface KPIData {
    totalSalesQty: number;
    totalRevenue: number;
    totalOutstanding: number;
    averageOrderValue: number; // Changed from uniqueProductsSold
}

// -------------------------------------------------------------
// SalesDashboard Component
// -------------------------------------------------------------

interface SalesDashboardProps {
    currentProductSearchTerm: string; // Not optional anymore
    categoryFilter: string;
    availabilityFilter: string;
    productsList: Product[]; // Pass the products list to map product_id to name
}

const SalesDashboard: React.FC<SalesDashboardProps> = ({ currentProductSearchTerm, categoryFilter, availabilityFilter, productsList }) => {
    const [salesData, setSalesData] = useState<SalesDataPoint[]>([]);
    const [kpiData, setKpiData] = useState<KPIData>({ totalSalesQty: 0, totalRevenue: 0, totalOutstanding: 0, averageOrderValue: 0 }); // Initialize AOV
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter states for graph
    const [metric, setMetric] = useState<'qty' | 'price' | 'total'>('total');
    const [lineMode, setLineMode] = useState<'combined' | 'perProduct'>('combined');
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
        from: subDays(new Date(), 30), // Default to last 30 days
        to: new Date(),
    });
    const [dateRangePreset, setDateRangePreset] = useState<'7d' | '30d' | '90d' | 'lifetime' | 'custom'>('30d');
    const [timeUnit, setTimeUnit] = useState<'day' | 'month' | 'year'>('day'); // New state for X-axis granularity


    useEffect(() => {
        const fetchSales = async () => {
            setLoading(true);
            setError(null);

            // Filter products based on search term, category, and availability
            let filteredProductsByUI: Product[] = productsList;

            if (currentProductSearchTerm) {
                filteredProductsByUI = filteredProductsByUI.filter(product =>
                    product.name.toLowerCase().includes(currentProductSearchTerm.toLowerCase()) ||
                    (product.description && product.description.toLowerCase().includes(currentProductSearchTerm.toLowerCase())) ||
                    (product.sku_id && product.sku_id.toLowerCase().includes(currentProductSearchTerm.toLowerCase()))
                );
            }

            if (categoryFilter !== 'all') {
                filteredProductsByUI = filteredProductsByUI.filter(product => product.category === categoryFilter);
            }

            if (availabilityFilter !== 'all') {
                filteredProductsByUI = filteredProductsByUI.filter(product => product.availability === availabilityFilter);
            }

            const productIdsToFilter = filteredProductsByUI.map(p => p.id);

            // If product filters result in no products, clear sales data and KPIs
            if (productIdsToFilter.length === 0 && (currentProductSearchTerm || categoryFilter !== 'all' || availabilityFilter !== 'all')) {
                setSalesData([]);
                setKpiData({ totalSalesQty: 0, totalRevenue: 0, totalOutstanding: 0, averageOrderValue: 0 }); // Reset KPI
                setLoading(false);
                return;
            }

            let fromDateISO: string | null = null;
            let toDateISO: string | null = null;

            if (dateRangePreset !== 'lifetime') {
                let fromDate = dateRange.from ? startOfDay(dateRange.from) : null;
                let toDate = dateRange.to ? endOfDay(dateRange.to) : null;

                if (timeUnit === 'month' && fromDate) {
                    fromDate = startOfMonth(fromDate);
                    toDate = endOfMonth(toDate || new Date());
                } else if (timeUnit === 'year' && fromDate) {
                    fromDate = startOfYear(fromDate);
                    toDate = endOfYear(toDate || new Date());
                }

                fromDateISO = fromDate ? fromDate.toISOString() : null;
                toDateISO = toDate ? toDate.toISOString() : null;
            }


            let query = supabase
                .from('sales')
                .select(`*, products!inner(name)`);

            if (fromDateISO && toDateISO) {
                query = query.gte('date', fromDateISO).lte('date', toDateISO);
            }

            // Apply product ID filter from the results of global product filters
            if (productIdsToFilter.length > 0) {
                query = query.in('product_id', productIdsToFilter);
            }


            const { data, error: fetchError } = await query;

            if (fetchError) {
                console.error("Error fetching sales data:", fetchError);
                setError("Failed to fetch sales data.");
                setLoading(false);
                setSalesData([]);
                setKpiData({ totalSalesQty: 0, totalRevenue: 0, totalOutstanding: 0, averageOrderValue: 0 }); // Reset KPI
                return;
            }

            // Process data for chart and KPIs
            const processedData = processSalesData(data as Sales[], lineMode, metric, productsList, timeUnit);
            setSalesData(processedData.chartData);
            setKpiData(processedData.kpiData);
            setLoading(false);
        };

        fetchSales();
    }, [dateRange, metric, lineMode, currentProductSearchTerm, categoryFilter, availabilityFilter, productsList, timeUnit, dateRangePreset]); // Re-fetch when these states change

    // Memoized function for data processing
    const processSalesData = useMemo(() => (
        sales: Sales[],
        mode: 'combined' | 'perProduct',
        selectedMetric: 'qty' | 'price' | 'total',
        allProducts: Product[],
        unit: 'day' | 'month' | 'year'
    ) => {
        const chartMap = new Map<string, SalesDataPoint>();
        let totalSalesQty = 0;
        let totalRevenue = 0;
        let totalOutstanding = 0;
        let totalOrders = sales.length; // Count of sales as total orders

        // Determine date format based on unit
        const getFormattedDate = (dateString: string) => {
            const date = new Date(dateString);
            if (unit === 'month') return format(date, 'yyyy-MM');
            if (unit === 'year') return format(date, 'yyyy');
            return format(date, 'yyyy-MM-dd');
        };

        sales.forEach(sale => {
            const dateKey = getFormattedDate(sale.date);

            totalSalesQty += sale.qty;
            totalRevenue += sale.total;
            totalOutstanding += sale.outstanding;

            if (mode === 'combined') {
                if (!chartMap.has(dateKey)) {
                    chartMap.set(dateKey, { date: dateKey, qty: 0, price: 0, total: 0 });
                }
                const current = chartMap.get(dateKey)!;
                current.qty! += sale.qty;
                current.price! += sale.price;
                current.total! += sale.total;
            } else { // perProduct mode
                const productName = allProducts.find(p => p.id === sale.product_id)?.name || `Unknown Product (${sale.product_id})`;
                if (!chartMap.has(dateKey)) {
                    chartMap.set(dateKey, { date: dateKey });
                }
                const current = chartMap.get(dateKey)!;
                if (!current[productName]) {
                    current[productName] = 0;
                }
                current[productName] += sale[selectedMetric];
            }
        });

        const sortedData = Array.from(chartMap.values()).sort((a, b) => {
            if (unit === 'month') return new Date(a.date + '-01').getTime() - new Date(b.date + '-01').getTime();
            if (unit === 'year') return new Date(a.date + '-01-01').getTime() - new Date(b.date + '-01-01').getTime();
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });

        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        if (mode === 'combined') {
            return {
                chartData: sortedData.map(d => ({ date: d.date, [selectedMetric]: d[selectedMetric] })),
                kpiData: { totalSalesQty, totalRevenue, totalOutstanding, averageOrderValue }
            };
        } else { // perProduct mode
            // Ensure all products appear in all date points with 0 if no sales for that period
            // This needs to be based on the *currently filtered* products, not allProducts
            const productNamesFromFilteredSales = Array.from(new Set(sales.map(s => allProducts.find(p => p.id === s.product_id)?.name || `Unknown Product (${s.product_id})`)));
            const finalChartData = sortedData.map(dataPoint => {
                const newPoint: SalesDataPoint = { date: dataPoint.date };
                productNamesFromFilteredSales.forEach(pName => {
                    newPoint[pName] = dataPoint[pName] || 0; // Ensure all products are present
                });
                return newPoint;
            });

            return {
                chartData: finalChartData,
                kpiData: { totalSalesQty, totalRevenue, totalOutstanding, averageOrderValue }
            };
        }

    }, []);

    const handleDateRangePresetChange = (preset: string) => {
        setDateRangePreset(preset as '7d' | '30d' | '90d' | 'lifetime' | 'custom');
        const today = new Date();
        if (preset === '7d') {
            setDateRange({ from: subDays(today, 7), to: today });
        } else if (preset === '30d') {
            setDateRange({ from: subDays(today, 30), to: today });
        } else if (preset === '90d') {
            setDateRange({ from: subDays(today, 90), to: today });
        } else if (preset === 'lifetime') {
            setDateRange({ from: undefined, to: undefined }); // Set to undefined for lifetime
        }
        // For 'custom', the Calendar component will handle dateRange state updates directly
    };

    const getMetricLabel = (m: 'qty' | 'price' | 'total') => {
        switch (m) {
            case 'qty': return 'Packages Sold';
            case 'price': return 'Sum of Price Per Unit';
            case 'total': return 'Total Revenue';
            default: return '';
        }
    };

    const getMetricColor = (m: 'qty' | 'price' | 'total') => {
        switch (m) {
            case 'qty': return '#8884d8'; // Purple
            case 'price': return '#82ca9d'; // Green
            case 'total': return '#ffc658'; // Yellow
            default: return '#8884d8';
        }
    }

    // Determine unique product names from the processed sales data for multi-line chart legends
    const productNamesForLines = useMemo(() => {
        if (lineMode === 'combined' || salesData.length === 0) return [];
        const allKeys = new Set<string>();
        salesData.forEach(d => {
            Object.keys(d).forEach(key => {
                if (key !== 'date') {
                    allKeys.add(key);
                }
            });
        });
        return Array.from(allKeys).sort();
    }, [salesData, lineMode]);


    if (error) {
        return (
            <Card className="healthcare-card">
                <CardContent className="pt-6">
                    <p className="text-destructive text-center">{error}</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[30%_1fr] gap-6 fade-in-up">
            {/* Left Section: KPI Metrics */}
            <Card className=" healthcare-card p-6 flex flex-col justify-around gap-4">
                <CardHeader className="p-0 pb-4">
                    <CardTitle className="text-2xl font-bold">Key Performance Indicators</CardTitle>
                </CardHeader>
                <CardContent className="p-0 grid grid-cols-1 gap-4"> {/* Adjusted for 4 KPIs */}
                    <div className="bg-gradient-to-br from-blue-100 to-blue-200 p-4 rounded-lg shadow-sm">
                        <p className="text-sm text-blue-800">Total Packages Sold</p>
                        <p className="text-4xl font-extrabold text-blue-900">{kpiData.totalSalesQty.toLocaleString()}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-100 to-purple-200 p-4 rounded-lg shadow-sm">
                        <p className="text-sm text-purple-800">Average Order Value</p>
                        <p className="text-4xl font-extrabold text-purple-900">₹{kpiData.averageOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-100 to-green-200 p-4 rounded-lg shadow-sm">
                        <p className="text-sm text-green-800">Total Revenue</p>
                        <p className="text-4xl font-extrabold text-green-900">₹{kpiData.totalRevenue.toLocaleString()}</p>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-100 to-yellow-200 p-4 rounded-lg shadow-sm">
                        <p className="text-sm text-yellow-800">Total Outstanding</p>
                        <p className="text-4xl font-extrabold text-yellow-900">₹{kpiData.totalOutstanding.toLocaleString()}</p>
                    </div>

                </CardContent>
            </Card>

            {/* Right Section: Sales Graph and Controls */}
            <Card className="col-span-1 healthcare-card p-6 flex flex-col">
                <CardHeader className="p-0 pb-4">
                    <CardTitle className="text-2xl font-bold">Sales Trend Analysis</CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex flex-col flex-grow">
                    {/* Graph Controls - Top Section */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                        {/* Date Range Picker */}
                        <div className="flex flex-col space-y-2">
                            <Label htmlFor="dateRange">Date Range</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="dateRange"
                                        variant={"outline"}
                                        className={`w-full justify-start text-left font-normal ${!dateRange.from && dateRangePreset !== 'lifetime' && "text-muted-foreground"
                                            }`}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateRangePreset === 'lifetime' ? (
                                            "Lifetime"
                                        ) : dateRange.from ? (
                                            dateRange.to ? (
                                                <>
                                                    {format(dateRange.from, "LLL dd, y")} -{" "}
                                                    {format(dateRange.to, "LLL dd, y")}
                                                </>
                                            ) : (
                                                format(dateRange.from, "LLL dd, y")
                                            )
                                        ) : (
                                            <span>Select a date range</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Select
                                        value={dateRangePreset}
                                        onValueChange={handleDateRangePresetChange}
                                    >
                                        <SelectTrigger className="w-[180px] m-2">
                                            <SelectValue placeholder="Select preset" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="lifetime">Lifetime</SelectItem>
                                            <SelectItem value="7d">Last 7 Days</SelectItem>
                                            <SelectItem value="30d">Last 30 Days</SelectItem>
                                            <SelectItem value="90d">Last 90 Days</SelectItem>
                                            <SelectItem value="custom">Custom Range</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {dateRangePreset === 'custom' && (
                                        <Calendar
                                            initialFocus
                                            mode="range"
                                            defaultMonth={dateRange.from}
                                            selected={
                                                dateRange.from && dateRange.to
                                                    ? { from: dateRange.from, to: dateRange.to }
                                                    : undefined
                                            }
                                            onSelect={setDateRange as any}
                                            numberOfMonths={2}
                                        />
                                    )}
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* X-Axis Granularity */}
                        <div className="flex flex-col space-y-2">
                            <Label htmlFor="timeUnit">Show by</Label>
                            <Select value={timeUnit} onValueChange={(value: 'day' | 'month' | 'year') => setTimeUnit(value)}>
                                <SelectTrigger className="w-full" id="timeUnit">
                                    <SelectValue placeholder="Select time unit" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="day">Day</SelectItem>
                                    <SelectItem value="month">Month</SelectItem>
                                    <SelectItem value="year">Year</SelectItem>
                                    {/* <SelectItem value="hour">Hour (requires timestamp data if present in db)</SelectItem> */}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Graph Rendering Area */}
                    <div className="h-[350px] w-full mb-6">
                        {loading ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                Loading sales data...
                            </div>
                        ) : salesData.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                No sales data available for the selected period and filters.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={salesData}
                                    margin={{
                                        top: 5,
                                        right: 30,
                                        left: 20,
                                        bottom: 5,
                                    }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" className='mt82' />
                                    <YAxis />
                                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                                    <Legend />
                                    {lineMode === 'combined' ? (
                                        <Line
                                            type="monotone"
                                            dataKey={metric}
                                            stroke={getMetricColor(metric)}
                                            activeDot={{ r: 8 }}
                                            name={getMetricLabel(metric)}
                                        />
                                    ) : (
                                        // Render multiple lines for each product
                                        productNamesForLines.map((pName, index) => (
                                            <Line
                                                key={pName}
                                                type="monotone"
                                                dataKey={pName}
                                                stroke={`hsl(${index * 60 % 360}, 70%, 50%)`} // Dynamic colors for up to 6 products
                                                activeDot={{ r: 8 }}
                                                name={pName}
                                            />
                                        ))
                                    )}
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* Graph Controls - Bottom Section */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-auto"> {/* mt-auto pushes to bottom */}
                        {/* Metric Toggle */}
                        <div className="flex flex-col space-y-2">
                            <Label htmlFor="metric">Metric to Display</Label>
                            <Select value={metric} onValueChange={(value: 'qty' | 'price' | 'total') => setMetric(value)}>
                                <SelectTrigger className="w-full" id="metric">
                                    <SelectValue placeholder="Select metric" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="qty">Packages Sold</SelectItem>
                                    <SelectItem value="price">Price Per Unit</SelectItem>
                                    <SelectItem value="total">Total Revenue</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Line Mode Toggle */}
                        <div className="flex flex-col space-y-2">
                            <Label htmlFor="lineMode">Graph Mode</Label>
                            <Select value={lineMode} onValueChange={(value: 'combined' | 'perProduct') => setLineMode(value)}>
                                <SelectTrigger className="w-full" id="lineMode">
                                    <SelectValue placeholder="Select line mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="combined">Combined Sales</SelectItem>
                                    <SelectItem value="perProduct">Sales Per Product</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SalesDashboard
