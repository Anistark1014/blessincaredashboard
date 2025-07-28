import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Tables } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Wallet, TrendingUp, TrendingDown, Package, ArrowLeft } from 'lucide-react';

import "react-quill/dist/quill.snow.css";

import {
    TooltipProps,
} from "recharts";
import { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";
import { CSSProperties } from "react";

// Recharts imports for the graph
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

// Date-fns for date manipulation
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

// Shadcn Popover and Calendar for date range picker
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

// Utility for conditional class names (assuming this is available in your project)
import { cn } from '@/lib/utils';

type Product = Tables<'products'>;
type Sales = Tables<'sales'>;

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
    totalSalesQty: number; // This will conceptually represent total units sold for other calculations
    totalRevenue: number;
    totalOutstanding: number;
    averageOrderValue: number;
    // RENAMED: totalSales to turnover
    turnover: number;
    totalPaid: number;
    // RENAMED: gmv to totalUnitsSold
    totalUnitsSold: number;
    numTransactions: number;
}

// -------------------------------------------------------------
// SalesDashboard Component
// -------------------------------------------------------------

interface SalesDashboardProps {
    currentProductSearchTerm: string;
    categoryFilter: string;
    availabilityFilter: string;
    productsList: Product[];
}

// Basic formatCurrency utility (can be more advanced with i18n)
const formatCurrency = (amount: number, currency = '₹') => {
    return `${currency}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const SalesDashboard: React.FC<SalesDashboardProps> = ({ currentProductSearchTerm, categoryFilter, availabilityFilter, productsList }) => {
    const [salesData, setSalesData] = useState<SalesDataPoint[]>([]);
    const [kpiData, setKpiData] = useState<KPIData>({
        totalSalesQty: 0,
        totalRevenue: 0,
        totalOutstanding: 0,
        averageOrderValue: 0,
        // RENAMED: totalSales to turnover
        turnover: 0,
        totalPaid: 0,
        // RENAMED: gmv to totalUnitsSold
        totalUnitsSold: 0,
        numTransactions: 0,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter states for graph
    const [metric, setMetric] = useState<'qty' | 'price' | 'total'>('total');
    const [lineMode, setLineMode] = useState<'combined' | 'perProduct'>('combined');
    interface DateRange { from: Date | undefined; to: Date | undefined; }
    const [dateRange, setDateRange] = useState<DateRange>({
        from: subDays(new Date(), 30),
        to: new Date(),
    });
    const [dateRangePreset, setDateRangePreset] = useState<'7d' | '30d' | '90d' | 'lifetime' | 'custom'>('30d');
    const [timeUnit, setTimeUnit] = useState<'day' | 'month' | 'year'>('day');

    // State for managing the Popover for custom date range
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    // This state controls the swap of content within the left card
    const [showProductIndexView, setShowProductIndexView] = useState(false);


    useEffect(() => {
        const fetchSales = async () => {
            setLoading(true);
            setError(null);

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

            if (productIdsToFilter.length === 0 && (currentProductSearchTerm || categoryFilter !== 'all' || availabilityFilter !== 'all')) {
                setSalesData([]);
                setKpiData({
                    totalSalesQty: 0,
                    totalRevenue: 0,
                    totalOutstanding: 0,
                    averageOrderValue: 0,
                    // RENAMED: totalSales to turnover
                    turnover: 0,
                    totalPaid: 0,
                    // RENAMED: gmv to totalUnitsSold
                    totalUnitsSold: 0,
                    numTransactions: 0,
                });
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

            if (productIdsToFilter.length > 0) {
                query = query.in('product_id', productIdsToFilter);
            }

            const { data, error: fetchError } = await query;

            if (fetchError) {
                console.error("Error fetching sales data:", fetchError);
                setError("Failed to fetch sales data.");
                setLoading(false);
                setSalesData([]);
                setKpiData({
                    totalSalesQty: 0,
                    totalRevenue: 0,
                    totalOutstanding: 0,
                    averageOrderValue: 0,
                    // RENAMED: totalSales to turnover
                    turnover: 0,
                    totalPaid: 0,
                    // RENAMED: gmv to totalUnitsSold
                    totalUnitsSold: 0,
                    numTransactions: 0,
                });
                return;
            }

            const processedData = processSalesData(data as Sales[], lineMode, metric, productsList, timeUnit);
            setSalesData(processedData.chartData);
            setKpiData(processedData.kpiData);
            setLoading(false);
        };

        fetchSales();
    }, [dateRange, metric, lineMode, currentProductSearchTerm, categoryFilter, availabilityFilter, productsList, timeUnit, dateRangePreset]);

const processSalesData = useMemo(() => (
    sales: Sales[],
    mode: 'combined' | 'perProduct',
    selectedMetric: 'qty' | 'price' | 'total',
    allProducts: Product[],
    unit: 'day' | 'month' | 'year'
) => {
    const chartMap = new Map<string, SalesDataPoint>();
    let totalSalesQty = 0; // This variable will now track 'Total Units Sold'
    let totalPaid = 0;
    let totalSalesValue = 0; // This variable will now track 'Turnover'
    // The original 'totalGMV' variable can be removed or repurposed if needed, but 'totalUnitsSold' is directly tied to totalSalesQty
    let numTransactions = sales.length;

    const getFormattedDate = (dateString: string) => {
        const date = new Date(dateString);
        if (unit === 'month') return format(date, 'yyyy-MM');
        if (unit === 'year') return format(date, 'yyyy');
        return format(date, 'yyyy-MM-dd');
    };

    sales.forEach(sale => {
        const dateKey = getFormattedDate(sale.date);

        totalSalesQty += sale.qty; // Summing up quantities for 'Total Units Sold'
        totalPaid += sale.paid;
        totalSalesValue += sale.price * sale.qty; // Summing up (price * qty) for 'Turnover'

        // The 'mrp' and 'totalGMV' calculation were for the original 'GMV' metric.
        // If 'Total Units Sold' should exclusively be `totalSalesQty`, then `totalGMV`
        // is no longer directly used for the 'totalUnitsSold' KPI.
        // const mrp = allProducts.find(p => p.id === sale.product_id)?.mrp || 0;
        // totalGMV += mrp * sale.qty; // If you still need GMV for other purposes, keep this line.

        if (mode === 'combined') {
            if (!chartMap.has(dateKey)) {
                chartMap.set(dateKey, { date: dateKey, qty: 0, price: 0, total: 0 });
            }
            const current = chartMap.get(dateKey)!;
            current.qty! += sale.qty;
            current.price! += sale.price;
            current.total! += sale.total;
        } else {
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

    const averageOrderValue = numTransactions > 0 ? totalPaid / numTransactions : 0;
    // Calculation of totalOutstanding now uses 'totalSalesValue' which represents 'Turnover'
    const totalOutstanding = totalSalesValue - totalPaid;

    if (mode === 'combined') {
        return {
            chartData: sortedData.map(d => ({ date: d.date, [selectedMetric]: d[selectedMetric] })),
            kpiData: {
                totalSalesQty: totalSalesQty, // This still tracks total quantity for internal use if needed
                totalRevenue: totalPaid,
                totalOutstanding,
                averageOrderValue,
                // ASSIGNMENT: totalSalesValue to turnover
                turnover: totalSalesValue,
                totalPaid,
                // ASSIGNMENT: totalSalesQty to totalUnitsSold
                totalUnitsSold: totalSalesQty,
                numTransactions
            }
        };
    } else {
        const productNamesFromFilteredSales = Array.from(
            new Set(sales.map(s => allProducts.find(p => p.id === s.product_id)?.name || `Unknown Product (${s.product_id})`))
        );

        const finalChartData = sortedData.map(dataPoint => {
            const newPoint: SalesDataPoint = { date: dataPoint.date };
            productNamesFromFilteredSales.forEach(pName => {
                newPoint[pName] = dataPoint[pName] || 0;
            });
            return newPoint;
        });

        return {
            chartData: finalChartData,
            kpiData: {
                totalSalesQty: totalSalesQty, // This still tracks total quantity for internal use if needed
                totalRevenue: totalPaid,
                totalOutstanding,
                averageOrderValue,
                // ASSIGNMENT: totalSalesValue to turnover
                turnover: totalSalesValue,
                totalPaid,
                // ASSIGNMENT: totalSalesQty to totalUnitsSold
                totalUnitsSold: totalSalesQty,
                numTransactions
            }
        };
    }

}, []);
    // Update this line to use 'turnover' instead of 'totalSales'
    const totalBalanceDue = kpiData.turnover - kpiData.totalPaid;

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
            setDateRange({ from: undefined, to: undefined });
        }
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
            case 'qty': return '#8884d8';
            case 'price': return '#82ca9d';
            case 'total': return '#ffc658';
            default: return '#8884d8';
        }
    }

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

    const CustomTooltip = ({
        active,
        payload,
        label,
    }: TooltipProps<ValueType, NameType>) => {
        if (active && payload && payload.length) {
            return (
                <div className="rounded-lg border border-border bg-popover text-popover-foreground p-3 shadow-md backdrop-blur-md">
                    <p className="font-semibold text-sm mb-2">{label}</p>
                    <div className="flex flex-col gap-1">
                        {payload.map((entry, index) => {
                            const colorDotStyle: CSSProperties = {
                                backgroundColor: entry.color || "#000",
                            };
                            return (
                                <div key={index} className="flex items-center gap-2 text-sm">
                                    <span
                                        className="w-3 h-3 rounded-full inline-block"
                                        style={colorDotStyle}
                                    />
                                    <span className="font-medium">{entry.name}:</span>
                                    <span>{Number(entry.value).toLocaleString()}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }
        return null;
    };

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
        <div className="flex flex-col gap-6 fade-in-up">
            {/* KPI Metrics - Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Turn Over</CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(kpiData.turnover)}</div>
                        <p className="text-xs text-muted-foreground">From {kpiData.numTransactions} transactions</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Revenue Received</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{formatCurrency(kpiData.totalPaid)}</div>
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
                        <CardTitle className="text-sm font-medium">Total Units Sold </CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{(kpiData.totalUnitsSold)}</div>
                        <p className="text-xs text-muted-foreground">Total Packs</p>
                    </CardContent>
                </Card>
            </div>

            {/* Sales Graph and Controls */}
            <div className="p-0 flex flex-grow flex-col md:flex-row gap-6">
                {/* Left Section: Controls or Product Index View */}
                <Card className="health-care md:w-1/3 p-4 border rounded-lg shadow-inner flex flex-col gap-6"> {/* Removed overflow-hidden */}
                    {showProductIndexView ? (
                        <div className="flex flex-col flex-grow h-full overflow-y-auto"> {/* Added h-full, min-h, flex-grow */}
                            <div className="flex flex-col items-start justify-between mb-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowProductIndexView(false)}
                                    className="px-2"
                                >
                                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Controls
                                </Button>
                                <h3 className="text-base md:text-lg font-semibold text-center flex-grow mt-2">Product Line Index</h3> {/* Centered title */}
                                {/* Empty div for spacing if needed */}
                                <div className="w-10"></div> {/* Match button width */}
                            </div>
                            <div className="flex flex-col gap-3 overflow-y-auto"> {/* Renamed from flex-wrap to flex-col for consistent vertical scroll, and added overflow-y-auto */}
                                <div className="flex flex-wrap gap-3"> {/* Reverted to flex-wrap here for the actual items */}
                                    {productNamesForLines.map((pName, index) => {
                                        const color = `hsl(${index * 60 % 360}, 70%, 50%)`;
                                        return (
                                            <div key={pName} className="flex items-center gap-2">
                                                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: color }}></span>
                                                <span className="text-sm text-gray-800 dark:text-gray-200">{pName}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Original Controls Section
                        <div className="flex flex-col gap-4">
                            {/* Date Range Preset Select */}
                            <div className="flex flex-col space-y-2">
                                <Label htmlFor="dateRangePreset">Date Range Preset</Label>
                                <Select value={dateRangePreset} onValueChange={handleDateRangePresetChange}>
                                    <SelectTrigger className="w-full" id="dateRangePreset">
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
                            </div>

                            {/* Custom Date Range Picker Popover */}
                            {dateRangePreset === 'custom' && (
                                <div className="flex flex-col space-y-2">
                                    <Label htmlFor="customDateRange">Custom Date Range</Label>
                                    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                id="customDateRange"
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !dateRange.from && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {dateRange.from ? (
                                                    dateRange.to ? (
                                                        <>
                                                            {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                                                        </>
                                                    ) : (
                                                        format(dateRange.from, "LLL dd, y")
                                                    )
                                                ) : (
                                                    <span>Pick a date range</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0 flex" align="start">
                                            <div className="flex flex-col space-y-1 p-2 border-r min-w-[140px] bg-muted/40 rounded-l-lg">
                                                <Button
                                                    variant="ghost"
                                                    className="justify-start rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-lavender/20 focus:bg-lavender/30 focus:outline-none"
                                                    onClick={() => {
                                                        const now = new Date();
                                                        setDateRange({
                                                            from: startOfMonth(now),
                                                            to: endOfDay(now),
                                                        });
                                                        setIsPopoverOpen(false);
                                                    }}
                                                >
                                                    This Month
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    className="justify-start rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-lavender/20 focus:bg-lavender/30 focus:outline-none"
                                                    onClick={() => {
                                                        const now = new Date();
                                                        const lastMonthStart = startOfMonth(subDays(now, 30));
                                                        const lastMonthEnd = endOfMonth(subDays(now, 30));
                                                        setDateRange({
                                                            from: lastMonthStart,
                                                            to: lastMonthEnd,
                                                        });
                                                        setIsPopoverOpen(false);
                                                    }}
                                                >
                                                    Last Month
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    className="justify-start rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-lavender/20 focus:bg-lavender/30 focus:outline-none"
                                                    onClick={() => {
                                                        const now = new Date();
                                                        setDateRange({
                                                            from: startOfYear(now),
                                                            to: endOfDay(now),
                                                        });
                                                        setIsPopoverOpen(false);
                                                    }}
                                                >
                                                    This Year
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    className="justify-start rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-lavender/20 focus:bg-lavender/30 focus:outline-none"
                                                    onClick={() => {
                                                        setDateRange({
                                                            from: new Date(2000, 0, 1),
                                                            to: endOfDay(new Date()),
                                                        });
                                                        setIsPopoverOpen(false);
                                                    }}
                                                >
                                                    All Time
                                                </Button>
                                            </div>
                                            <div className="p-2 bg-muted/40 rounded-r-lg">
                                                <Calendar
                                                    initialFocus
                                                    mode="range"
                                                    defaultMonth={dateRange.from}
                                                    selected={dateRange}
                                                    onSelect={setDateRange as any}
                                                    numberOfMonths={2}
                                                />
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            )}

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
                                    </SelectContent>
                                </Select>
                            </div>

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

                            {/* Line Mode Toggle and "Index" button */}
                            <div className="flex flex-col space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="lineMode">Graph Mode</Label>
                                    {lineMode === 'perProduct' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowProductIndexView(true)}
                                        >
                                            Index
                                        </Button>
                                    )}
                                </div>
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
                    )}
                </Card>

                {/* Right Section: Graph Only */}
                <Card className="md:flex-1 health-care p-4 border rounded-lg shadow-inner h-[400px]">
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
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip content={<CustomTooltip />} />
                                {lineMode === 'combined' ? (
                                    <Line
                                        type="monotone"
                                        dataKey={metric}
                                        stroke={getMetricColor(metric)}
                                        activeDot={{ r: 8 }}
                                        name={getMetricLabel(metric)}
                                    />
                                ) : (
                                    productNamesForLines.map((pName, index) => (
                                        <Line
                                            key={pName}
                                            type="monotone"
                                            dataKey={pName}
                                            stroke={`hsl(${index * 60 % 360}, 70%, 50%)`}
                                            activeDot={{ r: 8 }}
                                            name={pName}
                                        />
                                    ))
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default SalesDashboard;