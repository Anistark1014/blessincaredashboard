import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Tables } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Edit, Trash2, Package, Box, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { useNavigate } from "react-router-dom";
import "react-quill/dist/quill.snow.css";

import ProductForm from '@/components/product_components/ProductForm';
import SalesDashboard from '@/components/product_components/SalesDashboard';
import ProductExcelImport from '@/components/product_components/ProductExcelImport';

type Product = Tables<'products'>;

interface PriceRange {
    min: number;
    max: number;
    price: number;
}

interface MediaItem {
    type: 'image' | 'video';
    url: string;
}

interface ProductFormData {
    id?: string;
    name: string;
    description?: string;
    availability?: string;
    created_at?: string;
    image_url?: string;
    category?: string;
    info_link?: string;
    sku_id?: string | null;
    gross_profit: number | null;
    cost_price: number | null;
    mrp: number | null;
    price_ranges?: PriceRange[];
    media?: MediaItem[] | null;
    inventory?: number | null;
}

    const AdminProducts = () => {
        // Listen for command palette events to open modals
        useEffect(() => {
            const handleOpenAdd = () => setIsAddModalOpen(true);
            const handleOpenImport = () => {
                const importBtn = document.querySelector('[data-command-import-btn]');
                if (importBtn) (importBtn as HTMLElement).click();
                else {
                  const importSection = document.getElementById('import-products-section');
                  if (importSection) importSection.scrollIntoView({ behavior: 'smooth' });
                }
            };
            const handleOpenExport = () => {
                const exportBtn = document.querySelector('[data-command-export-btn]');
                if (exportBtn) (exportBtn as HTMLElement).click();
            };
            window.addEventListener('open-add-product-modal', handleOpenAdd);
            window.addEventListener('open-import-product', handleOpenImport);
            window.addEventListener('open-export-product', handleOpenExport);
            return () => {
                window.removeEventListener('open-add-product-modal', handleOpenAdd);
                window.removeEventListener('open-import-product', handleOpenImport);
                window.removeEventListener('open-export-product', handleOpenExport);
            };
        }, []);
        // Hide KPI/Graph state (default: hidden)
        const [hideKpi, setHideKpi] = useState(true);

        const navigate = useNavigate();
        const [products, setProducts] = useState<Product[]>([]);
        const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
        const [searchTerm, setSearchTerm] = useState('');
        const [categoryFilter, setCategoryFilter] = useState('all');
        const [sortOption, setSortOption] = useState('name_desc'); // Default sort option
        const [loading, setLoading] = useState(true);
        const [isAddModalOpen, setIsAddModalOpen] = useState(false);
        const [isEditModalOpen, setIsEditModalOpen] = useState(false);
        const [editingProduct, setEditingProduct] = useState<Product | null>(null);
        const [formData, setFormData] = useState<ProductFormData>({
            name: '',
            description: '',
            image_url: '',
            category: '',
            availability: 'In Stock',
            gross_profit: 0,
            sku_id: "",
            cost_price: 0,
            mrp: 0,
            price_ranges: [
                {
                    min: 1,
                    max: 100,
                    price: 100
                }
            ],
            media: []
        });

        const { toast } = useToast();

        // Bulk import handler
        const handleBulkImport = async (products: any[]) => {
            if (!Array.isArray(products) || products.length === 0) {
                toast({ title: 'Error', description: 'No products found in file.', variant: 'destructive' });
                return;
            }
            // Clean up and normalize fields for DB
            const normalized = products.map((p, index) => {
                // Helper function to convert string to number or null
                const parseNumber = (value: any) => {
                    if (value === null || value === undefined || value === '') return null;
                    const num = Number(value);
                    return isNaN(num) ? null : num;
                };

                return {
                    id: `temp-${Date.now()}-${index}`, // Temporary ID for optimistic update
                    name: p.name || 'Untitled Product',
                    description: p.description || null,
                    availability: p.availability || 'In Stock',
                    created_at: new Date().toISOString(),
                    image_url: p.image_url || null,
                    category: p.category || null,
                    info_link: p.info_link || null,
                    sku_id: p.sku_id || null,
                    gross_profit: parseNumber(p.gross_profit),
                    cost_price: parseNumber(p.cost_price),
                    mrp: parseNumber(p.mrp),
                    inventory: parseNumber(p.inventory),
                    price_ranges: p.price_ranges ? (typeof p.price_ranges === 'string' ? p.price_ranges : JSON.stringify(p.price_ranges)) : null,
                    media: p.media ? (typeof p.media === 'string' ? p.media : JSON.stringify(p.media)) : null,
                };
            });

            // Optimistically add products to UI
            const optimisticProducts = normalized.map(p => ({ ...p }));
            setProducts(prev => [...optimisticProducts, ...prev].sort((a, b) =>
                (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
            ));

            try {
                // Remove temporary IDs for database insert
                const dbNormalized = normalized.map(({ id, ...rest }) => rest);
                const { data, error } = await supabase.from('products').insert(dbNormalized).select();
                if (error) throw error;

                // Replace optimistic products with real data
                setProducts(prev => {
                    const withoutOptimistic = prev.filter(p => !p.id.toString().startsWith('temp-'));
                    return [...(data as Product[]), ...withoutOptimistic].sort((a, b) =>
                        (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
                    );
                });

                toast({ title: 'Success', description: 'Products imported successfully!' });
            } catch (error) {
                console.error('Bulk import error:', error);
                // Revert optimistic update
                setProducts(prev => prev.filter(p => !p.id.toString().startsWith('temp-')));
                toast({ title: 'Error', description: 'Bulk import failed.', variant: 'destructive' });
            }
        };

        // Removed uniqueCategories and uniqueAvailabilities memoization
        // and defined fixed lists for filters as requested.

        const fixedCategories = [
            "Sanitary Napkins",
            "Baby Care",
            "Adult Diapers",
            "Machines",
            "Maternity Pads",
            "Period Underwear",
            "Tampons",
            "Menstrual Cups",
        ];

        // const fixedAvailabilities = [
        //     "In Stock",
        //     "Out of Stock",
        //     "Low Stock"
        // ];



        useEffect(() => {
            fetchProducts();

            // Helper to refetch products on any relevant event
            const handleRelevantChange = () => {
                fetchProducts();
            };

            // Subscribe to products changes (for local UI update)
            const productsChannel = supabase
                .channel('products-changes')
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'products' },
                    (payload) => {
                        setProducts(prev => {
                            let updated;
                            if (payload.eventType === 'INSERT') {
                                updated = [payload.new as Product, ...prev];
                            } else if (payload.eventType === 'UPDATE') {
                                updated = prev.map(p =>
                                    p.id === payload.new.id ? payload.new as Product : p
                                );
                            } else if (payload.eventType === 'DELETE') {
                                updated = prev.filter(p => p.id !== payload.old.id);
                            } else {
                                updated = prev;
                            }
                            // Sort alphabetically by name (case-insensitive)
                            return updated.sort((a, b) =>
                                (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
                            );
                        });
                    }
                )
                .subscribe();

            // Subscribe to sales, expenses, and inventory changes
            const salesChannel = supabase
                .channel('sales-changes')
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'sales' },
                    handleRelevantChange
                )
                .subscribe();

            const expensesChannel = supabase
                .channel('expenses-changes')
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'expenses' },
                    handleRelevantChange
                )
                .subscribe();

            const inventoryChannel = supabase
                .channel('inventory-changes')
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'inventory' },
                    handleRelevantChange
                )
                .subscribe();

            return () => {
                supabase.removeChannel(productsChannel);
                supabase.removeChannel(salesChannel);
                supabase.removeChannel(expensesChannel);
                supabase.removeChannel(inventoryChannel);
            };
        }, []);

        useEffect(() => {
            filterProducts();
        }, [products, searchTerm, categoryFilter, sortOption]); // Depend on new filter states

        const fetchProducts = async () => {
            try {
                const { data, error } = await supabase
                    .from('products')
                    .select('*');

                if (error) throw error;
                // Sort alphabetically by name (case-insensitive)
                const sorted = (data as Product[]).sort((a, b) =>
                    (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
                );
                setProducts(sorted);
            } catch (error) {
                toast({
                    title: "Error",
                    description: "Failed to fetch products",
                    variant: "destructive"
                });
            } finally {
                setLoading(false);
            }
        };

        const filterProducts = () => {
            let filtered = products;

            if (searchTerm) {
                filtered = filtered.filter(product =>
                    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (product.sku_id && product.sku_id.toLowerCase().includes(searchTerm.toLowerCase()))
                );
            }

            if (categoryFilter !== 'all') {
                filtered = filtered.filter(product => product.category === categoryFilter);
            }


            // Apply sorting
            const sortedFiltered = [...filtered].sort((a, b) => {
                switch (sortOption) {
                    case 'name_asc':
                        return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
                    case 'name_desc':
                        return (b.name || '').toLowerCase().localeCompare((a.name || '').toLowerCase());
                    case 'date_newest':
                        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
                    case 'date_oldest':
                        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
                    case 'price_low_high':
                        const priceA = a.mrp || 0;
                        const priceB = b.mrp || 0;
                        return priceA - priceB;
                    case 'price_high_low':
                        const priceC = a.mrp || 0;
                        const priceD = b.mrp || 0;
                        return priceD - priceC;
                    case 'inventory_low_high':
                        return (a.inventory || 0) - (b.inventory || 0);
                    case 'inventory_high_low':
                        return (b.inventory || 0) - (a.inventory || 0);
                    case 'category_asc':
                        return (a.category || '').toLowerCase().localeCompare((b.category || '').toLowerCase());
                    case 'category_desc':
                        return (b.category || '').toLowerCase().localeCompare((a.category || '').toLowerCase());
                    default:
                        return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
                }
            });

            setFilteredProducts(sortedFiltered);
        };

        const handleAddProduct = async (e: React.FormEvent) => {
            e.preventDefault();

            if (!formData.name) {
                toast({
                    title: "Error",
                    description: "Please fill in all required fields",
                    variant: "destructive"
                });
                return;
            }

            // Ensure all nullable fields are null, not undefined
            const normalizedFormData = {
                ...formData,
                description: formData.description ?? null,
                availability: formData.availability ?? null,
                created_at: formData.created_at ?? null,
                image_url: formData.image_url ?? null,
                category: formData.category ?? null,
                info_link: formData.info_link ?? null,
                sku_id: formData.sku_id ?? null,
                gross_profit: formData.gross_profit ?? null,
                cost_price: formData.cost_price ?? null,
                mrp: formData.mrp ?? null,
                price_ranges: formData.price_ranges ? JSON.parse(JSON.stringify(formData.price_ranges)) : [],
                media: formData.media ? JSON.parse(JSON.stringify(formData.media)) : null,
            };

            // Optimistically add product to UI
            const tempId = `temp-${Date.now()}`;
            const optimisticProduct = {
                ...normalizedFormData,
                id: tempId,
                created_at: new Date().toISOString(),
            } as Product;

            setProducts(prev => [optimisticProduct, ...prev].sort((a, b) =>
                (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
            ));

            try {
                const { data, error } = await supabase
                    .from('products')
                    .insert([normalizedFormData])
                    .select();

                if (error) throw error;

                // Replace optimistic product with real data
                setProducts(prev => prev.map(p => 
                    p.id === tempId ? data[0] as Product : p
                ));

                setIsAddModalOpen(false);
                resetForm();
                toast({
                    title: "Success",
                    description: "Product added successfully"
                });
            } catch (error) {
                // Revert optimistic update
                setProducts(prev => prev.filter(p => p.id !== tempId));
                toast({
                    title: "Error",
                    description: "Failed to add product",
                    variant: "destructive"
                });
            }
        };

        const handleEditProduct = async (e: React.FormEvent) => {
            e.preventDefault();

            if (!editingProduct || !formData.name || !formData.price_ranges) {
                toast({
                    title: "Error",
                    description: "Please fill in all required fields",
                    variant: "destructive"
                });
                return;
            }

            // Store original product for potential revert
            const originalProduct = editingProduct;

            // Optimistically update product in UI
            const updatedProduct = { ...editingProduct, ...formData } as Product;
            setProducts(prev => prev.map(p =>
                p.id === editingProduct.id ? updatedProduct : p
            ).sort((a, b) =>
                (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
            ));

            try {
                const { error } = await supabase
                    .from('products')
                    .update(formData as any)
                    .eq('id', editingProduct.id);

                if (error) throw error;

                setIsEditModalOpen(false);
                setEditingProduct(null);
                resetForm();
                toast({
                    title: "Success",
                    description: "Product updated successfully"
                });
            } catch (error) {
                // Revert optimistic update
                setProducts(prev => prev.map(p =>
                    p.id === editingProduct.id ? originalProduct : p
                ));
                toast({
                    title: "Error",
                    description: "Failed to update product",
                    variant: "destructive"
                });
                console.log(error);
            }
        };

        const deleteProduct = async (id: string) => {
            if (!confirm('Are you sure you want to delete this product?')) return;

            // Store the product being deleted for potential revert
            const productToDelete = products.find(p => p.id === id);
            if (!productToDelete) return;

            // Optimistically remove product from UI
            setProducts(prev => prev.filter(p => p.id !== id));

            try {
                const { error } = await supabase
                    .from('products')
                    .delete()
                    .eq('id', id);

                if (error) throw error;

                toast({
                    title: "Success",
                    description: "Product deleted successfully"
                });
            } catch (error) {
                // Revert optimistic update
                setProducts(prev => [productToDelete, ...prev].sort((a, b) =>
                    (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
                ));
                toast({
                    title: "Error",
                    description: "Failed to delete product",
                    variant: "destructive"
                });
                console.log(error);
            }
        };

        const openEditModal = (product: Product) => {
            setEditingProduct(product);
            setFormData({
                name: product.name,
                description: product.description || '',
                image_url: product.image_url || '',
                availability: product.availability || 'In Stock',
                gross_profit: product.gross_profit || 0,
                sku_id: product.sku_id || '',
                category: product.category || '',
                media: Array.isArray(product.media)
                    ? product.media
                    : typeof product.media === 'string'
                        ? JSON.parse(product.media)
                        : product.media === null || product.media === undefined
                            ? []
                            : [],
                info_link: product.info_link || '',
                cost_price: product.cost_price || 0,
                mrp: product.mrp || 0,
                price_ranges: Array.isArray(product.price_ranges)
                    ? product.price_ranges
                    : typeof product.price_ranges === 'string'
                        ? JSON.parse(product.price_ranges)
                        : [],
            });
            setIsEditModalOpen(true);
        };

        const resetForm = useCallback(() => {
            setFormData({
                name: '',
                description: '',
                image_url: '',
                availability: 'In Stock',
                gross_profit: 0,
                sku_id: '',
                category: '',
                media: [],
                info_link: '',
                cost_price: 0,
                mrp: 0,
                price_ranges: [
                    { min: 1, max: 100, price: 100 },
                ],
            });
        }, []);



        const handleAddCancel = useCallback(() => {
            setIsAddModalOpen(false);
            resetForm();
        }, [resetForm]);

        const handleEditCancel = useCallback(() => {
            setIsEditModalOpen(false);
            setEditingProduct(null);
            resetForm();
        }, [resetForm]);

        if (loading) {
            return (
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
                </div>
            );
        }


return (

    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6 ">
      <div className="healthcare-card fade-in-up flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4">
        <div className="flex items-center gap-3 min-w-0">
          <Box className="h-12 w-12 sm:h-14 sm:w-14 text-primary flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-lg sm:text-xl font-bold text-foreground leading-tight truncate">Product Management</span>
            <span className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-snug truncate max-w-[220px] sm:max-w-none">Manage your healthcare products portfolio, including adding, editing, and deleting products.</span>
          </div>
        </div>
        <div className="flex flex-row gap-2 items-center mt-2 sm:mt-0 w-full sm:w-auto justify-start sm:justify-end">
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button
                className="min-w-[85%] max-w-[90%] px-4 py-2 text-sm font-semibold"
                variant="default"
              >
                + Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
                <DialogDescription>Fill in the product details and submit to add a new product to the system.</DialogDescription>
              </DialogHeader>
              <ProductForm
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleAddProduct}
                onCancel={handleAddCancel}
              />
            </DialogContent>
          </Dialog>
          <button
            title={hideKpi ? 'Show KPI & Graph' : 'Hide KPI & Graph'}
            onClick={() => setHideKpi(!hideKpi)}
            className="duration-300 sm:max-w-[20%] flex items-center justify-center rounded-md p-2 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={hideKpi ? 'Show KPI & Graph' : 'Hide KPI & Graph'}
          >
            {hideKpi ? (
              <ArrowDownCircle className="h-6 w-6 text-foreground hover:text-white duration-300" />
            ) : (
              <ArrowUpCircle className="h-6 w-6 text-foreground hover:text-white duration-300" />
            )}
          </button>
        </div>
      </div>
                {/* Sales Dashboard Section - Collapsible */}
                <div className={hideKpi ? 'hidden' : ''}>
                  <SalesDashboard
                      currentProductSearchTerm={searchTerm}
                      categoryFilter={categoryFilter}
                      availabilityFilter="all"
                      productsList={products}
                  />
                </div>


                {/* Filters (Search, Category, Availability) + Bulk Import */}
                <Card className="healthcare-card">
                    <CardContent className="pt-6 -mx-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4 w-full">
                            <div className="flex flex-1 w-full gap-2 items-center">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                    <Input
                                        placeholder="Search products by name, description, or SKU..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                                <div className="w-auto min-w-[120px]">
                                    <Select
                                        value={categoryFilter}
                                        onValueChange={setCategoryFilter}
                                    >
                                        <SelectTrigger className="w-full md:w-[140px]">
                                            <SelectValue placeholder="Category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All</SelectItem>
                                            {fixedCategories.map(category => (
                                                <SelectItem key={category} value={category}>
                                                    {category}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-auto min-w-[140px]">
                                    <Select
                                        value={sortOption}
                                        onValueChange={setSortOption}
                                    >
                                        <SelectTrigger className="w-full md:w-[160px]">
                                            <SelectValue placeholder="Sort by" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="name_asc">Name (A-Z)</SelectItem>
                                            <SelectItem value="name_desc">Name (Z-A)</SelectItem>
                                            <SelectItem value="date_newest">Newest First</SelectItem>
                                            <SelectItem value="date_oldest">Oldest First</SelectItem>
                                            <SelectItem value="price_low_high">Price (Low-High)</SelectItem>
                                            <SelectItem value="price_high_low">Price (High-Low)</SelectItem>
                                            <SelectItem value="inventory_low_high">Stock (Low-High)</SelectItem>
                                            <SelectItem value="inventory_high_low">Stock (High-Low)</SelectItem>
                                            <SelectItem value="category_asc">Category (A-Z)</SelectItem>
                                            <SelectItem value="category_desc">Category (Z-A)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex gap-2 items-center w-full sm:w-auto justify-end">
                                <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                                    <DialogTrigger asChild>
                                        <Button className="btn-healthcare" size="icon" variant="ghost" aria-label="Add Product">
                                            <Plus className="w-5 h-5" />
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl">
                                        <DialogHeader>
                                            <DialogTitle>Add New Product</DialogTitle>
                                            <DialogDescription>Fill in the product details and submit to add a new product to the system.</DialogDescription>
                                        </DialogHeader>
                                        <ProductForm
                                            formData={formData}
                                            setFormData={setFormData}
                                            onSubmit={handleAddProduct}
                                            onCancel={handleAddCancel}
                                        />
                                    </DialogContent>
                                </Dialog>
                                {/* Add a data attribute for command palette import trigger */}
                                <div data-command-import-products>
                                  <ProductExcelImport onDataParsed={handleBulkImport} products={products} />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>


                {/* Products Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProducts.map((product) => (
                        <Card onClick={() => navigate(`/product/${product.id}`)} key={product.id} className="healthcare-card">
                            <CardHeader className="pb-3">
                                <div className="flex items-start gap-2 justify-between">
                                    <div className="flex-1">
                                        <CardTitle className="text-lg mb-1">{product.name}</CardTitle>
                                        <div className="flex justify-between items-center w-full">
                                            <Badge variant="outline">
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {(product.availability) ?? 'Unknown'} - {product.inventory ?? "0"}
                                                </p>
                                            </Badge>
                                            <p className="text-sm truncate text-muted-foreground mt-1">
                                                {product.sku_id || 'Unknown'}
                                            </p>

                                        </div>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                {product.image_url ? (
                                    <img
                                        src={product.image_url}
                                        alt={product.name}
                                        className="w-full h-40 object-cover rounded-md"
                                    />
                                ) : (
                                    <div className="w-full h-40 flex items-center justify-center bg-muted rounded-md">
                                        <Package className="w-10 h-10 text-muted-foreground" />
                                    </div>
                                )}




                                {/* {product.description && (
                                    <div
                                    className="text-sm text-muted-foreground line-clamp-2"
                                    dangerouslySetInnerHTML={{
                                            __html: product.description ?? ""
                                        }}
                                    />
                                )} */}



                                {/* <div className="space-y-1">
                                    <p className="text-sm font-medium text-muted-foreground mb-1">Category:</p>
                                    <Badge variant="outline" className="text-sm">
                                        {product.category || 'Uncategorized'}
                                    </Badge>
                                </div> */}

                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-muted-foreground mb-1">Price Chart:</p>
                                    {(() => {
                                        const priceRanges = product.price_ranges
                                            ? (Array.isArray(product.price_ranges)
                                                ? product.price_ranges
                                                : typeof product.price_ranges === 'string'
                                                    ? JSON.parse(product.price_ranges)
                                                    : []
                                            ) as PriceRange[]
                                            : [];
                                        
                                        return priceRanges.length ? (
                                            <table className="w-full text-sm border rounded overflow-hidden">
                                                <thead>
                                                    <tr className="bg-muted">
                                                        <th className="py-1 px-2 text-left font-semibold">QTY (Pieces)</th>
                                                        <th className="py-1 px-2 text-left font-semibold">Price (₹)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {priceRanges.map((range, idx) => (
                                                        <tr key={idx} className="border-t">
                                                            <td className="py-1 px-2">{range.min} – {range.max}</td>
                                                            <td className="py-1 px-2">₹{range.price}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <p className="text-sm text-muted-foreground italic">No pricing info</p>
                                        );
                                    })()}
                                </div>
                                

                                <div className="flex gap-2 pt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={(e) => {
                                            e.stopPropagation(); // 👈 Prevent card click
                                            openEditModal(product)
                                        }}
                                    >
                                        <Edit className="w-4 h-4 mr-2" />
                                        Edit
                                    </Button>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-destructive hover:text-destructive"
                                        onClick={(e) => {
                                            e.stopPropagation(); // 👈 Prevent card click
                                            deleteProduct(product.id)
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>

                            </CardContent>
                        </Card>
                    ))}
                </div>

                {filteredProducts.length === 0 && (
                    <Card className="healthcare-card">
                        <CardContent className="pt-6">
                            <div className="text-center py-8">
                                <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                                <h3 className="text-lg font-medium text-foreground mb-2">No products found</h3>
                                <p className="text-muted-foreground mb-4">
                                    Try adjusting your search criteria or add a new product.
                                </p>
                                <Button className="btn-healthcare" onClick={() => setIsAddModalOpen(true)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add New Product
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Edit Modal */}
                <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Edit Product</DialogTitle>
                            <DialogDescription>Edit the product details and submit to update the product in the system.</DialogDescription>
                        </DialogHeader>
                        <ProductForm
                            formData={formData}
                            setFormData={setFormData}
                            onSubmit={handleEditProduct}
                            isEdit
                            onCancel={handleEditCancel}
                        />
                    </DialogContent>
                </Dialog>
            </div>
        );
    };

    export default AdminProducts;