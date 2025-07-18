import  { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Tables } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Edit, Trash2, Package, DollarSign, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Product = Tables<'products'>;

interface ProductFormData {
  name: string;
  description: string;
  category: string;
  type: string;
  price: number;
  inventory: number;
  min_stock_alert: number;
  production_status: string;
  image_url?: string;
  availability: 'In Stock' | 'Low Stock' | 'Out of Stock';
}

const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    category: '',
    type: '',
    price: 0,
    inventory: 0,
    min_stock_alert: 0,
    production_status: '',
    image_url: '',
    availability: "In Stock",
  });
  const { toast } = useToast();

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
  }, [products, searchTerm, categoryFilter, statusFilter]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data as  Product[]);
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
        (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(product => product.category === categoryFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(product => product.production_status === statusFilter);
    }

    setFilteredProducts(filtered);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.category || !formData.price) {
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
        .insert([formData]);

      if (error) throw error;

      setIsAddModalOpen(false);
      resetForm();
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
    
    if (!editingProduct || !formData.name || !formData.category || !formData.price) {
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
        .update(formData)
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
    }
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      type: product.type || '',
      price: product.price || 0,
      inventory: product.inventory || 0,
      min_stock_alert: product.min_stock_alert || 0,
      production_status: product.production_status || '',
      image_url: product.image_url || '',
      availability:product.availability || 'In Stock',
      
    });
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      type: '',
      price: 0,
      inventory: 0,
      min_stock_alert: 0,
      production_status: '',
      image_url: '',
      availability: 'In Stock',

    });
  };



  const getStatusBadgeVariant = (status: string | null) => {
    switch (status) {
      case 'Manufacturing': return 'secondary';
      case 'Ready for Distribution': return 'default';
      case 'Out of Stock': return 'destructive';
      default: return 'outline';
    }
  };

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  const statuses = [...new Set(products.map(p => p.production_status).filter(Boolean))];

  // Calculate stats
  const totalProducts = products.length;
  const inStockProducts = products.filter(p => (p.inventory || 0) > 0).length;
  const lowStockProducts = products.filter(p => 
    (p.inventory || 0) <= (p.min_stock_alert || 0) && (p.inventory || 0) > 0
  ).length;
  const averagePrice = products.length > 0 
    ? products.reduce((sum, p) => sum + (p.price || 0), 0) / products.length 
    : 0;

const ProductForm = ({onSubmit,isEdit = false,}: {onSubmit: (e: React.FormEvent) => void;isEdit?: boolean}) => (
  <form onSubmit={onSubmit} className="space-y-4">
    <div>
      <Label htmlFor="name">Name *</Label>
      <Input
        id="name"
        value={formData?.name ?? ""}
        onChange={(e) =>
          setFormData((prev) => ({ ...prev, name: e.target.value }))
        }
        required
      />
    </div>

    <div>
      <Label htmlFor="description">Description</Label>
      <Textarea
        id="description"
        value={formData?.description ?? ""}
        onChange={(e) =>
          setFormData((prev) => ({ ...prev, description: e.target.value }))
        }
        rows={3}
      />
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="category">Category *</Label>
        <Input
          id="category"
          value={formData?.category ?? ""}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, category: e.target.value }))
          }
          required
        />
      </div>
      <div>
        <Label htmlFor="type">Type</Label>
        <Input
          id="type"
          value={formData?.type ?? ""}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, type: e.target.value }))
          }
        />
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="price">Price *</Label>
        <Input
          id="price"
          type="number"
          step="0.01"
          min="0"
          value={formData?.price ?? ""}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              price: parseFloat(e.target.value) || 0,
            }))
          }
          required
        />
      </div>
      <div>
        <Label htmlFor="inventory">Inventory</Label>
        <Input
          id="inventory"
          type="number"
          min="0"
          value={formData?.inventory ?? ""}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              inventory: parseInt(e.target.value) || 0,
            }))
          }
        />
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="min_stock_alert">Min Stock Alert</Label>
        <Input
          id="min_stock_alert"
          type="number"
          min="0"
          value={formData?.min_stock_alert ?? ""}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              min_stock_alert: parseInt(e.target.value) || 0,
            }))
          }
        />
      </div>
      <div>
        <Label htmlFor="production_status">Production Status</Label>
        <Select
          value={formData?.production_status ?? ""}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, production_status: value }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Manufacturing">Manufacturing</SelectItem>
            <SelectItem value="Ready for Distribution">
              Ready for Distribution
            </SelectItem>
            <SelectItem value="Out of Stock">Out of Stock</SelectItem>
            <SelectItem value="Discontinued">Discontinued</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="image_url">Image URL</Label>
        <Input
          id="image_url"
          type="url"
          value={formData?.image_url ?? ""}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, image_url: e.target.value }))
          }
          placeholder="https://example.com/image.jpg"
        />
      </div>
      <div>
        <Label htmlFor="availability">Availability</Label>
        <Select
          value={formData?.availability ?? ""}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, availability: value }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="In Stock">In Stock</SelectItem>
            <SelectItem value="Out of Stock">Out of Stock</SelectItem>
            <SelectItem value="Low Stock">Low Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div className="flex justify-end gap-2 pt-4">
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          if (isEdit) {
            setIsEditModalOpen(false);
            setEditingProduct(null);
          } else {
            setIsAddModalOpen(false);
          }
          resetForm();
        }}
      >
        Cancel
      </Button>
      <Button type="submit">
        {isEdit ? "Update Product" : "Add Product"}
      </Button>
    </div>
  </form>
);



  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }
console.log(formData)
  return (
    <div className="space-y-6 fade-in-up">
      {/* Header */}
      <div className="healthcare-card">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Product Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage your healthcare product inventory with real-time updates
            </p>
          </div>
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
              <ProductForm onSubmit={handleAddProduct} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="healthcare-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold text-foreground">{totalProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="healthcare-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-success" />
              <div>
                <p className="text-sm text-muted-foreground">In Stock</p>
                <p className="text-2xl font-bold text-success">{inStockProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="healthcare-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold text-warning">{lowStockProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="healthcare-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Avg. Price</p>
                <p className="text-2xl font-bold text-foreground">${averagePrice.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="healthcare-card">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category ?? 'none'}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statuses.map(status => (
                  <SelectItem key={status} value={status ?? 'none'}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product) => (
          <Card key={product.id} className="healthcare-card">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{product.category}</p>
                </div>
                <Badge variant={getStatusBadgeVariant(product.production_status)}>
                  {product.production_status || 'Unknown'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-primary">${product.price}</span>
                <span 
                  className={`text-sm font-medium ${
                    (product.inventory || 0) <= (product.min_stock_alert || 0)
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }`}
                >
                  Stock: {product.inventory || 0}
                </span>
              </div>
              
              {product.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {product.description}
                </p>
              )}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditModal(product)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteProduct(product.id)}
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
          <ProductForm onSubmit={handleEditProduct} isEdit />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProducts;