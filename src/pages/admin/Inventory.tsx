import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Warehouse,
  AlertTriangle,
  Package,
  TrendingUp,
  TrendingDown,
  SortAsc,
  SortDesc,
  Box,
} from "lucide-react";
// import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  inventory: number;
  min_stock_alert: number;
  image_url: string;
  price_ranges?: PriceRange[];
}

interface PriceRange {
  min: number;
  max: number;
  price: number;
}

interface Expense {
  id: string;
  type: string;
  category: string;
  amount: number;
  date: string;
  description: string | null;
  inventory_transaction_id: string | null;
}

interface InventoryTransaction {
  id: string;
  product_id: string;
  product_name: string;
  type: string;
  quantity: number;
  cost_per_unit: number | null;
  transaction_date: string;
  notes: string | null;
}

interface Request {
  id: string;
  products_ordered: any;
  status: string;
  request_date: string;
}

interface ProductSummary extends Product {
  purchased_this_month: number;
  sold_this_month: number;
}

interface ShrinkageLog {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  date: string;
  notes: string | null;
}

const Inventory: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [productSummaries, setProductSummaries] = useState<ProductSummary[]>(
    []
  );
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // KPI states
  const [totalStockNumber, setTotalStockNumber] = useState(0);
  const [totalStockValue, setTotalStockValue] = useState(0);
  const [totalStockPurchased, setTotalStockPurchased] = useState(0);
  const [totalStockSold, setTotalStockSold] = useState(0);
  const [sales, setSales] = useState<any[]>([]);

  // Form states
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");

  // Shrinkage states
  const [shrinkageModalOpen, setShrinkageModalOpen] = useState(false);
  const [shrinkageProductId, setShrinkageProductId] = useState("");
  const [shrinkageQty, setShrinkageQty] = useState("");
  const [shrinkageNotes, setShrinkageNotes] = useState("");
  const [shrinkageLogsOpen, setShrinkageLogsOpen] = useState(false);
  const [shrinkageLogs, setShrinkageLogs] = useState<ShrinkageLog[]>([]);
  // Handle Shrinkage
  const handleShrinkage = async () => {
    if (!shrinkageProductId || !shrinkageQty) {
      toast({
        title: "Missing Information",
        description: "Please select a product and enter shrinkage quantity.",
        variant: "destructive",
      });
      return;
    }

    const selectedProduct = products.find((p) => p.id === shrinkageProductId);
    if (!selectedProduct) return;

    const qty = parseInt(shrinkageQty);
    if (qty <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Shrinkage quantity must be positive.",
        variant: "destructive",
      });
      return;
    }

    // Optimistically update inventory
    const originalInventory = selectedProduct.inventory;
    const newInventory = (originalInventory || 0) - qty;
    const updatedProducts = products.map((p) =>
      p.id === shrinkageProductId
        ? { ...p, inventory: newInventory }
        : p
    );
    setProducts(updatedProducts);

    // Create optimistic transaction
    const tempTransactionId = `temp-shrinkage-${Date.now()}`;
    const optimisticTransaction: InventoryTransaction = {
      id: tempTransactionId,
      product_id: shrinkageProductId,
      product_name: selectedProduct.name,
      type: "loss",
      quantity: qty,
      cost_per_unit: null,
      transaction_date: new Date().toISOString().split("T")[0],
      notes: shrinkageNotes || null,
    };
    setTransactions(prev => [optimisticTransaction, ...prev]);

    // Reset form optimistically
    const originalFormState = {
      shrinkageProductId,
      shrinkageQty,
      shrinkageNotes
    };
    setShrinkageModalOpen(false);
    setShrinkageProductId("");
    setShrinkageQty("");
    setShrinkageNotes("");

    try {
      // Update product inventory
      const { error: updateError } = await supabase
        .from("products")
        .update({ inventory: newInventory })
        .eq("id", shrinkageProductId);
      if (updateError) throw updateError;

      // Remove the optimistic transaction since we're not storing it in the database
      setTransactions(prev => prev.filter(t => t.id !== tempTransactionId));

      // Save shrinkage log to database
      const { error: logError } = await supabase
        .from('shrinkage_logs')
        .insert({
          product_id: shrinkageProductId,
          product_name: selectedProduct.name,
          quantity: qty,
          notes: shrinkageNotes || null,
        });
      
      if (logError) {
        console.error("Error saving shrinkage log:", logError);
        toast({
          title: "Warning",
          description: "Stock updated but failed to save log.",
          variant: "destructive",
        });
      }

      // Refresh logs
      const { data: updatedLogs } = await supabase
        .from('shrinkage_logs')
        .select('*')
        .order('date', { ascending: false });
      
      if (updatedLogs) {
        setShrinkageLogs(updatedLogs);
      }

      toast({
        title: "Shrinkage Recorded",
        description: `Shrinkage of ${qty} units for ${selectedProduct.name} recorded.`,
      });
    } catch (error) {
      console.error("Error recording shrinkage:", error);
      
      // Revert optimistic updates
      setProducts(prev => prev.map(p => 
        p.id === shrinkageProductId ? { ...p, inventory: originalInventory } : p
      ));
      setTransactions(prev => prev.filter(t => t.id !== tempTransactionId));
      
      // Restore form state
      setShrinkageModalOpen(true);
      setShrinkageProductId(originalFormState.shrinkageProductId);
      setShrinkageQty(originalFormState.shrinkageQty);
      setShrinkageNotes(originalFormState.shrinkageNotes);
      
      toast({
        title: "Error",
        description: "Failed to record shrinkage.",
        variant: "destructive",
      });
    }
  };

  // Filter and sort states
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortField, setSortField] = useState<keyof ProductSummary>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Time range filter states
  const [timeRange, setTimeRange] = useState("all"); // Default to all time
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  // Load shrinkage logs
  const fetchShrinkageLogs = async () => {
    const { data: logs, error } = await supabase
      .from('shrinkage_logs')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) {
      console.error("Error fetching shrinkage logs:", error);
      toast({
        title: "Error",
        description: "Failed to load shrinkage history.",
        variant: "destructive",
      });
    } else if (logs) {
      setShrinkageLogs(logs);
    }
  };

  useEffect(() => {
    fetchShrinkageLogs();
  }, []);

  // Check if user is admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      navigate("/reseller");
    }
  }, [user, navigate, toast]);

  // Fetch data and set up real-time listeners
  useEffect(() => {
    if (!user || user.role !== "admin") return;

    fetchAllData();
    setupRealtimeListeners();
  }, [user]);

  const fetchAllData = async () => {
    try {
      setLoading(true);

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("*");

      if (productsError) throw productsError;
      setProducts(productsData as any[]);

      // Fetch transactions
      const { data: transactionsData, error: transactionsError } =
        await supabase
          .from("inventory_transactions")
          .select("*")
          .order("transaction_date", { ascending: false });

      if (transactionsError) throw transactionsError;
      setTransactions(transactionsData as any[]);

      // Fetch requests
      const { data: requestsData, error: requestsError } = await supabase
        .from("requests")
        .select("*");

      if (requestsError) throw requestsError;
      setRequests(requestsData as any[]);

      // Fetch sales
      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select("*");
      if (salesError) throw salesError;
      setSales(salesData as any[]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch inventory data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeListeners = () => {
    // Listen to products changes
    const productsChannel = supabase
      .channel("products-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          fetchAllData();
        }
      )
      .subscribe();

    // Listen to inventory transactions changes
    const transactionsChannel = supabase
      .channel("transactions-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventory_transactions" },
        () => {
          fetchAllData();
        }
      )
      .subscribe();

    // Listen to requests changes
    const requestsChannel = supabase
      .channel("requests-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requests" },
        () => {
          fetchAllData();
        }
      )
      .subscribe();

    // Listen to sales changes
    const salesChannel = supabase
      .channel("sales-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        () => {
          fetchAllData();
        }
      )
      .subscribe();

    // Listen to expenses changes
    const expensesChannel = supabase
      .channel("expenses-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses" },
        () => {
          fetchAllData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(transactionsChannel);
      supabase.removeChannel(requestsChannel);
      supabase.removeChannel(salesChannel);
      supabase.removeChannel(expensesChannel);
    };
  };

  // Calculate date range based on selected filter
  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (timeRange) {
      case "1":
        startDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
        break;
      case "2":
        startDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        break;
      case "7":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "custom":
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          // Set end date to end of day for more accurate filtering
          endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
        } else {
          // Fallback to all time if custom dates not set
          startDate = new Date(2000, 0, 1);
        }
        break;
      case "all":
        startDate = new Date(2000, 0, 1);
        break;
      default:
        startDate = new Date(2000, 0, 1);
    }

    return { startDate, endDate };
  };

  // Calculate KPIs and product summaries
  useEffect(() => {
    if (products.length > 0) {
      // Calculate total stock number and value
      const stockNumber = products.reduce(
        (sum, product) => sum + (Number(product.inventory) || 0),
        0
      );
      const stockValue = products.reduce((totalValue, product) => {
        const inventory = Number(product.inventory) || 0;
        let averagePrice = product.price || 0;
        if (product.price_ranges && Array.isArray(product.price_ranges) && product.price_ranges.length > 0) {
          const totalPrice = product.price_ranges.reduce(
            (sum, range) => sum + range.price,
            0
          );
          averagePrice = totalPrice / product.price_ranges.length;
        }
        return totalValue + inventory * averagePrice;
      }, 0);
      setTotalStockNumber(stockNumber);
      setTotalStockValue(stockValue);

      const { startDate, endDate } = getDateRange();

      const totalStockPurchased = transactions
        .filter(
          (t) =>
            t.type === "purchase" &&
            new Date(t.transaction_date) >= startDate &&
            new Date(t.transaction_date) <= endDate
        )
        .reduce((sum, t) => sum + t.quantity, 0);

      // Calculate total sold units using sales table
      const totalStockSold = sales
        .filter((sale) => {
          const saleDate = new Date(
            sale.date || sale.created_at || sale.transaction_date
          );
          return saleDate >= startDate && saleDate <= endDate;
        })
        .reduce((sum, sale) => sum + (sale.qty || sale.quantity || 0), 0);

      setTotalStockPurchased(totalStockPurchased);
      setTotalStockSold(totalStockSold);

      // Calculate monthly data using the selected date range
      const summaries = products.map((product) => {
        // Calculate purchased in selected time range
        const purchasedInRange = transactions
          .filter((t) => {
            const transactionDate = new Date(t.transaction_date);
            return (
              t.product_id === product.id &&
              t.type === "purchase" &&
              transactionDate >= startDate &&
              transactionDate <= endDate
            );
          })
          .reduce((sum, t) => sum + t.quantity, 0);

        // Calculate sold in selected time range using sales table
        const soldInRange = sales
          .filter((sale) => {
            const saleDate = new Date(
              sale.date || sale.created_at || sale.transaction_date
            );
            return (
              sale.product_id === product.id &&
              saleDate >= startDate &&
              saleDate <= endDate
            );
          })
          .reduce((sum, sale) => sum + (sale.qty || sale.quantity || 0), 0);

        return {
          ...product,
          purchased_this_month: purchasedInRange,
          sold_this_month: soldInRange,
        };
      });

      setProductSummaries(summaries);
    }
  }, [
    products,
    transactions,
    requests,
    sales,
    timeRange,
    customStartDate,
    customEndDate,
  ]);

  const handleStockPurchase = async () => {
    if (!selectedProductId || !quantity) {
      toast({
        title: "Missing Information",
        description: "Please select a product and enter quantity.",
        variant: "destructive",
      });
      return;
    }

    const selectedProduct = products.find((p) => p.id === selectedProductId);
    if (!selectedProduct) return;

    const qtyToAdd = parseInt(quantity);
    const costPerUnitValue = costPerUnit ? parseFloat(costPerUnit) : null;

    // Optimistically update product inventory
    const originalInventory = selectedProduct.inventory;
    const updatedProducts = products.map((p) =>
      p.id === selectedProductId
        ? { ...p, inventory: p.inventory + qtyToAdd }
        : p
    );
    setProducts(updatedProducts);

    // Create optimistic transaction
    const tempTransactionId = `temp-${Date.now()}`;
    const optimisticTransaction: InventoryTransaction = {
      id: tempTransactionId,
      product_id: selectedProductId,
      product_name: selectedProduct.name,
      type: "purchase",
      quantity: qtyToAdd,
      cost_per_unit: costPerUnitValue,
      transaction_date: purchaseDate,
      notes: notes || null,
    };
    setTransactions(prev => [optimisticTransaction, ...prev]);

    // Reset form optimistically
    const originalFormState = {
      selectedProductId,
      quantity,
      costPerUnit,
      notes
    };
    setSelectedProductId("");
    setQuantity("");
    setCostPerUnit("");
    setNotes("");
    setIsModalOpen(false);

    try {
      // Create inventory transaction and get its ID
      const { data: transactionData, error: transactionError } = await supabase
        .from("inventory_transactions")
        .insert({
          product_id: selectedProductId,
          product_name: selectedProduct.name,
          type: "purchase",
          quantity: qtyToAdd,
          cost_per_unit: costPerUnitValue,
          transaction_date: purchaseDate,
          notes: notes || null,
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Replace optimistic transaction with real data
      setTransactions(prev => prev.map(t => 
        t.id === tempTransactionId ? {
          id: transactionData.id,
          product_id: transactionData.product_id,
          product_name: transactionData.product_name,
          type: transactionData.type,
          quantity: transactionData.quantity,
          cost_per_unit: transactionData.cost_per_unit,
          transaction_date: transactionData.transaction_date,
          notes: transactionData.notes
        } : t
      ));

      // Create expense record for the purchase, linking to inventory_transaction_id
      if (
        costPerUnitValue &&
        costPerUnitValue > 0 &&
        transactionData &&
        transactionData.id
      ) {
        const totalCost = costPerUnitValue * qtyToAdd;

        const { data: expenseData, error: expenseError } = await supabase
          .from("expenses")
          .insert({
            type: "expense",
            category: "Stock Purchase",
            amount: totalCost,
            date: new Date(purchaseDate).toISOString(),
            description: `Stock purchase: ${quantity} units of ${
              selectedProduct.name
            } at ₹${costPerUnitValue} per unit${notes ? ` - ${notes}` : ""}`,
            inventory_transaction_id: transactionData.id,
          })
          .select()
          .single();

        if (expenseError) {
          console.error("Error creating expense record:", expenseError);
          // Don't throw error here as the main transaction was successful
          toast({
            title: "Warning",
            description: "Stock purchase recorded but expense tracking failed.",
            variant: "destructive",
          });
        } else {
          console.log("Expense record created:", expenseData);
        }
      }

      // Update product inventory
      const { error: updateError } = await supabase
        .from("products")
        .update({
          inventory: originalInventory + qtyToAdd,
        })
        .eq("id", selectedProductId);

      if (updateError) throw updateError;

      toast({
        title: "Stock Updated",
        description: `Successfully added ${qtyToAdd} units to ${selectedProduct.name}`,
      });

    } catch (error) {
      console.error("Error recording stock purchase:", error);
      
      // Revert optimistic updates
      setProducts(prev => prev.map(p => 
        p.id === selectedProductId ? { ...p, inventory: originalInventory } : p
      ));
      setTransactions(prev => prev.filter(t => t.id !== tempTransactionId));
      
      // Restore form state
      setSelectedProductId(originalFormState.selectedProductId);
      setQuantity(originalFormState.quantity);
      setCostPerUnit(originalFormState.costPerUnit);
      setNotes(originalFormState.notes);
      setIsModalOpen(true);
      
      toast({
        title: "Error",
        description: "Failed to record stock purchase.",
        variant: "destructive",
      });
    }
  };

  const getFilteredAndSortedProducts = () => {
    let filtered = productSummaries;

    // Apply filters
    if (categoryFilter && categoryFilter !== "all") {
      filtered = filtered.filter((p) => p.category === categoryFilter);
    }

    if (lowStockOnly) {
      filtered = filtered.filter((p) => p.inventory <= p.min_stock_alert);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = (bValue as string).toLowerCase();
      }

      if (sortDirection === "asc") {
        return (aValue ?? 0) < (bValue ?? 0)
          ? -1
          : (aValue ?? 0) > (bValue ?? 0)
          ? 1
          : 0;
      } else {
        return (aValue ?? 0) > (bValue ?? 0)
          ? -1
          : (aValue ?? 0) < (bValue ?? 0)
          ? 1
          : 0;
      }
    });

    return filtered;
  };

  const categories = [
    ...new Set(
      products
        .map((p) => p.category)
        .filter((category) => category && category.trim() !== "")
    ),
  ];

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex items-center space-x-3">
          <Warehouse className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold">
            Inventory Management
          </h1>
        </div>

        {/* Loading KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {Array.from({ length: 4 }, (_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 bg-gray-200 rounded"></div>
                <div className="h-4 w-4 bg-gray-200 rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 w-32 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Loading Table */}
        <Card>
          <div className="p-6">
            <div className="h-6 w-48 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6 ">
      <div className="healthcare-card fade-in-up flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Warehouse className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Inventory Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your healthcare product inventory with real-time tracking &
              analytics
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0">
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center space-x-2 w-full sm:w-auto">
                <Package className="h-4 w-4" />
                <span>Record Stock Purchase</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Record Stock Purchase</DialogTitle>
                <DialogDescription>Add new inventory by recording a stock purchase with quantity and cost details.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="product">Product</Label>
                  <Select
                    value={selectedProductId}
                    onValueChange={setSelectedProductId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter quantity"
                    min="1"
                  />
                </div>
                <div>
                  <Label htmlFor="cost">Cost Per Unit</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    value={costPerUnit}
                    onChange={(e) => setCostPerUnit(e.target.value)}
                    placeholder="Enter cost per unit"
                  />
                </div>
                <div>
                  <Label htmlFor="date">Purchase Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter any notes about this purchase"
                  />
                </div>
                <Button onClick={handleStockPurchase} className="w-full">
                  Record Purchase
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {/* Shrinkage Button and Modal */}
          <Dialog
            open={shrinkageModalOpen}
            onOpenChange={setShrinkageModalOpen}
          >
            <DialogTrigger asChild>
              <Button
                variant="destructive"
                className="flex items-center space-x-2 w-full sm:w-auto"
              >
                <AlertTriangle className="h-4 w-4" />
                <span>Add Shrinkage</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Record Inventory Shrinkage</DialogTitle>
                <DialogDescription>Record inventory loss due to damage, theft, or other shrinkage reasons.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="shrinkage_product">Product</Label>
                  <Select
                    value={shrinkageProductId}
                    onValueChange={setShrinkageProductId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="shrinkage_qty">Shrinkage Quantity</Label>
                  <Input
                    id="shrinkage_qty"
                    type="number"
                    value={shrinkageQty}
                    onChange={(e) => setShrinkageQty(e.target.value)}
                    placeholder="Enter shrinkage quantity"
                    min="1"
                  />
                </div>
                <div>
                  <Label htmlFor="shrinkage_notes">Notes (Optional)</Label>
                  <Textarea
                    id="shrinkage_notes"
                    value={shrinkageNotes}
                    onChange={(e) => setShrinkageNotes(e.target.value)}
                    placeholder="Enter any notes about this shrinkage"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleShrinkage}
                    className="flex-1"
                    variant="destructive"
                  >
                    Record Shrinkage
                  </Button>
                  <Button
                    onClick={() => setShrinkageLogsOpen(true)}
                    variant="outline"
                  >
                    View Logs
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Shrinkage Logs Dialog */}
          <Dialog open={shrinkageLogsOpen} onOpenChange={setShrinkageLogsOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Shrinkage History</DialogTitle>
                <DialogDescription>View all recorded inventory shrinkage entries.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="h-[400px] overflow-y-auto">
                  {shrinkageLogs.length === 0 ? (
                    <p className="text-center text-muted-foreground">No shrinkage records found.</p>
                  ) : (
                    <div className="space-y-4">
                      {shrinkageLogs.map(log => (
                        <Card key={log.id}>
                          <CardContent className="p-4">
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <h3 className="font-medium">{log.product_name}</h3>
                                <span className="text-destructive">{log.quantity} units</span>
                              </div>
                              <p className="text-sm text-muted-foreground">{new Date(log.date).toLocaleDateString()}</p>
                              {log.notes && (
                                <p className="text-sm border-t pt-2 mt-2">{log.notes}</p>
                              )}
                              <div className="flex gap-2 mt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    const newQty = window.prompt("Enter new quantity:", log.quantity.toString());
                                    if (!newQty) return;
                                    
                                    const qty = parseInt(newQty);
                                    if (isNaN(qty) || qty <= 0) {
                                      toast({
                                        title: "Invalid Quantity",
                                        description: "Please enter a valid positive number.",
                                        variant: "destructive",
                                      });
                                      return;
                                    }

                                    try {
                                      // Start transaction
                                      const product = products.find(p => p.id === log.product_id);
                                      if (!product) throw new Error("Product not found");

                                      // Calculate inventory adjustment
                                      const qtyDiff = log.quantity - qty; // positive means we're reducing shrinkage
                                      const newInventory = product.inventory + qtyDiff;

                                      // Update inventory
                                      const { error: updateError } = await supabase
                                        .from("products")
                                        .update({ inventory: newInventory })
                                        .eq("id", log.product_id);
                                      
                                      if (updateError) throw updateError;

                                      // Update shrinkage log
                                      const { error: logError } = await supabase
                                        .from('shrinkage_logs')
                                        .update({ quantity: qty })
                                        .eq('id', log.id);

                                      if (logError) throw logError;

                                      fetchShrinkageLogs();
                                      fetchAllData();
                                      
                                      toast({
                                        title: "Success",
                                        description: "Shrinkage record updated and inventory adjusted.",
                                      });
                                    } catch (error) {
                                      console.error("Error updating shrinkage:", error);
                                      toast({
                                        title: "Error",
                                        description: "Failed to update shrinkage record.",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                >
                                  Update Quantity
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={async () => {
                                    if (!window.confirm("Are you sure you want to delete this shrinkage record? This will restore the quantity back to inventory.")) {
                                      return;
                                    }

                                    try {
                                      // Start transaction
                                      const product = products.find(p => p.id === log.product_id);
                                      if (!product) throw new Error("Product not found");

                                      // Calculate new inventory (restore shrinkage quantity)
                                      const newInventory = product.inventory + log.quantity;

                                      // Update inventory
                                      const { error: updateError } = await supabase
                                        .from("products")
                                        .update({ inventory: newInventory })
                                        .eq("id", log.product_id);
                                      
                                      if (updateError) throw updateError;

                                      // Delete shrinkage log
                                      const { error: deleteError } = await supabase
                                        .from('shrinkage_logs')
                                        .delete()
                                        .eq('id', log.id);
                                      
                                      if (deleteError) throw deleteError;

                                      fetchShrinkageLogs();
                                      fetchAllData();
                                      
                                      toast({
                                        title: "Success",
                                        description: "Shrinkage record deleted and inventory restored.",
                                      });
                                    } catch (error) {
                                      console.error("Error deleting shrinkage:", error);
                                      toast({
                                        title: "Error",
                                        description: "Failed to delete shrinkage record.",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                >
                                  Delete Record
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="space-y-6"></div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <Card className="bg-gradient-to-r from-lavender/20 to-blush/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Stock Units
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">
              {totalStockNumber.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total units within all products
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-mint/20 to-sage/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Stock Value
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">
              ₹{totalStockValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total monetary value of inventory
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-lavender/20 to-blush/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Purchased Units
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">
              {totalStockPurchased.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {timeRange === "1" && "Total units purchased in last 1 day"}
              {timeRange === "2" && "Total units purchased in last 2 days"}
              {timeRange === "7" && "Total units purchased in last 7 days"}
              {timeRange === "30" && "Total units purchased in last 30 days"}
              {timeRange === "90" && "Total units purchased in last 90 days"}
              {timeRange === "custom" &&
                "Total units purchased in custom range"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-mint/20 to-sage/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Sold Units
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">
              {totalStockSold.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {timeRange === "1" && "Total units sold in last 1 day"}
              {timeRange === "2" && "Total units sold in last 2 days"}
              {timeRange === "7" && "Total units sold in last 7 days"}
              {timeRange === "30" && "Total units sold in last 30 days"}
              {timeRange === "90" && "Total units sold in last 90 days"}
              {timeRange === "custom" && "Total units sold in custom range"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Product Overview Grid */}
      {/* <div>
        <h2 className="text-xl font-semibold mb-4">Product Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map(product => {
            const isLowStock = product.inventory <= product.min_stock_alert;
            return (
              <Card key={product.id} className={`${isLowStock ? 'border-destructive bg-destructive/5' : ''}`}>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <h3 className="font-medium text-sm">{product.name}</h3>
                    <p className="text-xs text-muted-foreground">{product.category}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Stock: {product.inventory}</span>
                      {isLowStock && <AlertTriangle className="h-4 w-4 text-destructive" />}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${isLowStock ? 'bg-destructive' : 'bg-primary'}`}
                        style={{ 
                          width: `${Math.min(100, (product.inventory / (product.min_stock_alert * 2)) * 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div> */}

      {/* Inventory Details Table */}
      <div>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold">Inventory Details</h2>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Time Range Filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              <Select
                value={timeRange}
                onValueChange={(value) => {
                  setTimeRange(value);
                  if (value !== "custom") {
                    setShowCustomDatePicker(false);
                  }
                }}
              >
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="Time Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="1">Last 1 Day</SelectItem>
                  <SelectItem value="2">Last 2 Days</SelectItem>
                  <SelectItem value="7">Last 7 Days</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                  <SelectItem value="90">Last 90 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {/* Custom Range Button */}
              {timeRange === "custom" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCustomDatePicker(true)}
                  className="w-full sm:w-auto"
                >
                  Set Dates
                </Button>
              )}
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* <Button
              variant={lowStockOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className="w-full sm:w-auto"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Low Stock Only
            </Button> */}
          </div>
        </div>

        {/* Custom Date Range Dialog */}
        <Dialog
          open={showCustomDatePicker}
          onOpenChange={setShowCustomDatePicker}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Select Custom Date Range</DialogTitle>
              <DialogDescription>Choose a custom date range to filter inventory transactions and analytics.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCustomDatePicker(false);
                    setTimeRange("30"); // Reset to default
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (customStartDate && customEndDate) {
                      const startDate = new Date(customStartDate);
                      const endDate = new Date(customEndDate);

                      if (endDate < startDate) {
                        toast({
                          title: "Invalid Date Range",
                          description: "End date must be after start date.",
                          variant: "destructive",
                        });
                        return;
                      }

                      setShowCustomDatePicker(false);
                    } else {
                      toast({
                        title: "Missing Dates",
                        description: "Please select both start and end dates.",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  Apply
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => {
                      if (sortField === "name") {
                        setSortDirection(
                          sortDirection === "asc" ? "desc" : "asc"
                        );
                      } else {
                        setSortField("name");
                        setSortDirection("asc");
                      }
                    }}
                  >
                    <div className="flex items-center">
                      Product
                      {sortField === "name" &&
                        (sortDirection === "asc" ? (
                          <SortAsc className="h-4 w-4 ml-1" />
                        ) : (
                          <SortDesc className="h-4 w-4 ml-1" />
                        ))}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => {
                      if (sortField === "category") {
                        setSortDirection(
                          sortDirection === "asc" ? "desc" : "asc"
                        );
                      } else {
                        setSortField("category");
                        setSortDirection("asc");
                      }
                    }}
                  >
                    <div className="flex items-center">
                      Category
                      {sortField === "category" &&
                        (sortDirection === "asc" ? (
                          <SortAsc className="h-4 w-4 ml-1" />
                        ) : (
                          <SortDesc className="h-4 w-4 ml-1" />
                        ))}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => {
                      if (sortField === "purchased_this_month") {
                        setSortDirection(
                          sortDirection === "asc" ? "desc" : "asc"
                        );
                      } else {
                        setSortField("purchased_this_month");
                        setSortDirection("desc");
                      }
                    }}
                  >
                    <div className="flex items-center">
                      {timeRange === "1" && "Purchased (1 Day)"}
                      {timeRange === "2" && "Purchased (2 Days)"}
                      {timeRange === "7" && "Purchased (7 Days)"}
                      {timeRange === "30" && "Purchased (30 Days)"}
                      {timeRange === "90" && "Purchased (90 Days)"}
                      {timeRange === "custom" && "Purchased (Custom)"}
                      {sortField === "purchased_this_month" &&
                        (sortDirection === "asc" ? (
                          <SortAsc className="h-4 w-4 ml-1" />
                        ) : (
                          <SortDesc className="h-4 w-4 ml-1" />
                        ))}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => {
                      if (sortField === "inventory") {
                        setSortDirection(
                          sortDirection === "asc" ? "desc" : "asc"
                        );
                      } else {
                        setSortField("inventory");
                        setSortDirection("desc");
                      }
                    }}
                  >
                    <div className="flex items-center">
                      Current Stock
                      {sortField === "inventory" &&
                        (sortDirection === "asc" ? (
                          <SortAsc className="h-4 w-4 ml-1" />
                        ) : (
                          <SortDesc className="h-4 w-4 ml-1" />
                        ))}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => {
                      if (sortField === "sold_this_month") {
                        setSortDirection(
                          sortDirection === "asc" ? "desc" : "asc"
                        );
                      } else {
                        setSortField("sold_this_month");
                        setSortDirection("desc");
                      }
                    }}
                  >
                    <div className="flex items-center">
                      {timeRange === "1" && "Sold (1 Day)"}
                      {timeRange === "2" && "Sold (2 Days)"}
                      {timeRange === "7" && "Sold (7 Days)"}
                      {timeRange === "30" && "Sold (30 Days)"}
                      {timeRange === "90" && "Sold (90 Days)"}
                      {timeRange === "custom" && "Sold (Custom)"}
                      {sortField === "sold_this_month" &&
                        (sortDirection === "asc" ? (
                          <SortAsc className="h-4 w-4 ml-1" />
                        ) : (
                          <SortDesc className="h-4 w-4 ml-1" />
                        ))}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getFilteredAndSortedProducts().length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {products.length === 0
                        ? "No products found"
                        : "No products match the current filters"}
                    </TableCell>
                  </TableRow>
                ) : (
                  getFilteredAndSortedProducts().map((product) => {
                    const isLowStock =
                      product.inventory <= product.min_stock_alert;
                    return (
                      <TableRow
                        key={product.id}
                        className={`cursor-pointer hover:bg-muted/50 ${
                          isLowStock ? "bg-destructive/5" : ""
                        }`}
                        onClick={() => navigate("/admin/products")}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-2">
                            {product.name}
                            {isLowStock && (
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{product.category}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                            {product.purchased_this_month}
                          </div>
                        </TableCell>
                        <TableCell className="flex items-center">
                          {product.inventory < 200 ? (
                            <Box className="h-4 w-4 text-red-500 mr-1" />
                          ) : (
                            <Box className="h-4 w-4 text-green-500 mr-1" />
                          )}
                          <Badge
                            variant={isLowStock ? "destructive" : "secondary"}
                          >
                            {product.inventory || 0} units
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <TrendingDown className="h-4 w-4 text-orange-500 mr-1" />
                            {product.sold_this_month}
                          </div>
                        </TableCell>
                        <TableCell>{product.min_stock_alert}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Inventory;
