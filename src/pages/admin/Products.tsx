import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Tables } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Edit, Trash2, Package, Box } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { useNavigate } from "react-router-dom";
import "react-quill/dist/quill.snow.css";

import ProductForm from '@/components/product_components/ProductForm';
import SalesDashboard from '@/components/product_components/SalesDashboard';

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

        const navigate = useNavigate();
        const [products, setProducts] = useState<Product[]>([]);
        const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
        const [searchTerm, setSearchTerm] = useState('');
        const [categoryFilter, setCategoryFilter] = useState('all');
        const [availabilityFilter, setAvailabilityFilter] = useState('all'); // Renamed from statusFilter for clarity in UI
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

        // Removed uniqueCategories and uniqueAvailabilities memoization
        // and defined fixed lists for filters as requested.

        const fixedCategories = [
            "Sanitary Napkins",
            "Maternity Pads",
            "Period Underwear",
            "Tampons",
            "Menstrual Cups",
            "Wet Wipes",
            "Baby Diapers",
            "Adult Diapers",
            "Vending Machine",
            "Incinerator Machine"
        ];

        // const fixedAvailabilities = [
        //     "In Stock",
        //     "Out of Stock",
        //     "Low Stock"
        // ];


        useEffect(() => {
            fetchProducts();

            // Set up real-time subscription
            const channel = supabase
                .channel('products-changes')
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'products' },
                    (payload) => {
                        if (payload.eventType === 'INSERT') {
                            setProducts(prev => [payload.new as Product, ...prev]);
                        } else if (payload.eventType === 'UPDATE') {
                            setProducts(prev => prev.map(p =>
                                p.id === payload.new.id ? payload.new as Product : p
                            ));
                        } else if (payload.eventType === 'DELETE') {
                            setProducts(prev => prev.filter(p => p.id !== payload.old.id));
                        }
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }, []);

        useEffect(() => {
            filterProducts();
        }, [products, searchTerm, categoryFilter, availabilityFilter]); // Depend on new filter states

        const fetchProducts = async () => {
            try {
                const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setProducts(data as Product[]);
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

            if (availabilityFilter !== 'all') {
                filtered = filtered.filter(product => product.availability === availabilityFilter);
            }

            setFilteredProducts(filtered);
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

            try {
                const { error } = await supabase
                    .from('products')
                    .insert([normalizedFormData]);

                if (error) throw error;

                setIsAddModalOpen(false);
                toast({
                    title: "Success",
                    description: "Product added successfully"
                });
            } catch (error) {
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

        const uploadImageToSupabase = useCallback(async (file: File): Promise<string | null> => {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, file);

            if (uploadError) {
                console.error('Image upload failed:', uploadError.message);
                return null;
            }

            const { data } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            return data?.publicUrl || null;
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
      <div className="healthcare-card fade-in-up flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Box className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          <div>
              <h1 className="text-3xl font-bold text-foreground">Product Management</h1>
              <p className="text-muted-foreground mt-1">
                Manage your healthcare products portfolio, including adding, editing, and deleting products. 
              </p>
          </div>
        </div>
      </div>
                {/* Sales Dashboard Section - Rendered below header */}
                <SalesDashboard
                    currentProductSearchTerm={searchTerm}
                    categoryFilter={categoryFilter}
                    availabilityFilter={availabilityFilter}
                    productsList={products}
                />


                {/* Filters (Search, Category, Availability) */}
                <Card className="healthcare-card">
                    <CardContent className="pt-6 -mx-4"> {/* Adjusted padding */}
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1 ">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                <Input
                                    placeholder="Search products by name, description, or SKU..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>

                            {/* Category Filter */}
                            <div className="w-full md:w-auto">
                                <Select
                                    value={categoryFilter}
                                    onValueChange={setCategoryFilter}
                                >
                                    <SelectTrigger className="w-full md:w-[180px]">
                                        <SelectValue placeholder="Filter by Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Categories</SelectItem>
                                        {fixedCategories.map(category => ( // Using fixed categories
                                            <SelectItem key={category} value={category}>
                                                {category}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Availability Filter */}
                            {/* <div className="w-full md:w-auto">
                                <Select
                                    value={availabilityFilter}
                                    onValueChange={setAvailabilityFilter}
                                >
                                    <SelectTrigger className="w-full md:w-[180px]">
                                        <SelectValue placeholder="Filter by Availability" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Availabilities</SelectItem>
                                        {fixedAvailabilities.map(availability => ( // Using fixed availabilities
                                            <SelectItem key={availability} value={availability}>
                                                {availability}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div> */}

                            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                                <DialogTrigger asChild>
                                    <Button className="btn-healthcare">
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add New Product
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                        <DialogTitle>Add New Product</DialogTitle>
                                    </DialogHeader>
                                    <ProductForm
                                        formData={formData}
                                        setFormData={setFormData}
                                        onSubmit={handleAddProduct}
                                        onCancel={handleAddCancel}
                                        uploadImageToSupabase={uploadImageToSupabase}
                                    />
                                </DialogContent>
                            </Dialog>
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
                                {product.description && (
                                    <div
                                        className="text-sm text-muted-foreground line-clamp-2"
                                        dangerouslySetInnerHTML={{
                                            __html: product.description ?? ""
                                        }}
                                    />
                                )}
                                
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-muted-foreground mb-1">Price Ranges:</p>
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
                                                        <th className="py-1 px-2 text-left font-semibold">QTY</th>
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
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-muted-foreground mb-1">Category:</p>
                                    <Badge variant="outline" className="text-sm">
                                        {product.category || 'Uncategorized'}
                                    </Badge>
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
                        </DialogHeader>
                        <ProductForm
                            formData={formData}
                            setFormData={setFormData}
                            onSubmit={handleEditProduct}
                            isEdit
                            onCancel={handleEditCancel}
                            uploadImageToSupabase={uploadImageToSupabase}
                        />
                    </DialogContent>
                </Dialog>
            </div>
        );
    };

    export default AdminProducts;