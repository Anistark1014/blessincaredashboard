import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Tables } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Edit, Trash2, Package} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useNavigate } from "react-router-dom";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

// Create a properly typed wrapper for ReactQuill
const QuillEditor = ReactQuill as any;


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
  gross_profit: number | null; // ✅ Add this line
  cost_price: number | null; // ✅ Add this line
  mrp: number | null; // ✅ Add this line
  price_ranges?: PriceRange[];
  media?: MediaItem[]|null; // ✅ Integrated media field
}

// Move ProductForm outside as a separate component
const ProductForm = ({ 
  formData, 
  setFormData, 
  onSubmit, 
  isEdit = false, 
  onCancel,
  uploadImageToSupabase 
}: {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  isEdit?: boolean;
  onCancel: () => void;
  uploadImageToSupabase: (file: File) => Promise<string | null>;
}) => {
  const handlePriceRangeChange = useCallback((
    index: number,
    field: "min" | "max" | "price",
    value: number
  ) => {
    setFormData(prev => {
      const updatedRanges = [...(prev.price_ranges ?? [])];
      updatedRanges[index] = {
        ...updatedRanges[index],
        [field]: value
      };
      return {
        ...prev,
        price_ranges: updatedRanges
      };
    });
  }, [setFormData]);

  const addPriceRange = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      price_ranges: [...(prev.price_ranges ?? []), { min: 0, max: 0, price: 0 }]
    }));
  }, [setFormData]);

  const removePriceRange = useCallback((index: number) => {
    setFormData(prev => {
      const updatedRanges = [...(prev.price_ranges ?? [])];
      updatedRanges.splice(index, 1);
      return {
        ...prev,
        price_ranges: updatedRanges
      };
    });
  }, [setFormData]);

  return (
    <div className="h-[85vh] overflow-auto px-4 py-6">

    <form onSubmit={onSubmit} className="space-y-4 min-h-full">
      <div>
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          required
        />
      <div>
        <QuillEditor
          theme="snow"
          value={formData.description ?? ""}
          onChange={(value:string) =>
            setFormData((prev) => ({ ...prev, description: value }))
          }
        />
      </div>
          
      </div>
      <div className='flex justify-around items-center gap-4'>

        <div>
            <Label htmlFor="cost_price">Cost Price (₹)</Label>
            <Input
              id="cost_price"
              type="number"
              step="1"
              value={formData.cost_price ?? ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  cost_price: parseFloat(e.target.value) || 0,
                }))
              }
            />
        </div>
        <div>
            <Label htmlFor="mrp">MRP (₹)</Label>
            <Input
              id="mrp"
              type="number"
              step="1"
              value={formData.mrp ?? ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  mrp: parseFloat(e.target.value) || 0,
                }))
              }
            />
        </div>
        <div>
            <Label htmlFor="gross_profit">Gross Profit (₹)</Label>
            <Input
              id="gross_profit"
              type="number"
              step="1"
              value={formData.gross_profit ?? ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  gross_profit: parseFloat(e.target.value) || 0,
                }))
              }
            />
        </div>
      </div>
          <div className='flex justify-around items-center gap-2 '>
            <div className={cn('',isEdit?"hidden":"flex-1")}>
              <Label className='mb-2' htmlFor="sku_id">SKU ID <span className='text-xs ml-2'>(name-size-qty-type1-type2)</span></Label>
              <Input
                id="sku_id"
                type="text"
                value={formData.sku_id ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    sku_id:(e.target.value),
                  }))
                }
              />
            </div>
            <div className='flex-1'>
              <Label className='mb-2' htmlFor="info_link">Add link <span className='text-xs ml-2'>(Add Product Link)</span></Label>
              <Input
                id="info_link"
                type="text"
                value={formData.info_link ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    info_link:(e.target.value),
                  }))
                }
              />
            </div>
          </div>
      
      <div className='flex justify-around items-center gap-4'>
        <span className={cn('flex flex-col gap-4 ',formData.image_url?'':'w-full')}>
          <div>
            <Label htmlFor="availability">Availability</Label>
            <Select
              value={formData.availability ?? ""}
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
          {/* Category  */}
          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category ?? ""}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, category: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Sanitary Pads">Sanitary Pads</SelectItem>
                <SelectItem value="Maternity Pads">Maternity Pads</SelectItem>
                <SelectItem value="Incinerator Machine">Incinerator Machine</SelectItem>
                <SelectItem value="Wet Wipes">Wet Wipes</SelectItem>
                <SelectItem value="Baby Diapers">Baby Diapers</SelectItem>
                <SelectItem value="Adult Diapers">Adult Diapers</SelectItem>
                <SelectItem value="Menstrual Cups">Menstrual Cups</SelectItem>
                <SelectItem value="Period Underwear">Period Underwear</SelectItem>
                <SelectItem value="Tampons">Tampons</SelectItem>
                <SelectItem value="Vending Machine">Vending Machine</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="image">Product Image</Label>
            <Input
              id="image"
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // Show preview immediately
                  const previewUrl = URL.createObjectURL(file);
                  setFormData((prev) => ({ ...prev, image_url: previewUrl }));

                  // Upload to Supabase
                  const url = await uploadImageToSupabase(file);
                  if (url) {
                    setFormData((prev) => ({ ...prev, image_url: url }));
                  }
                }
              }}
            />
          </div>
        </span>
        <span>
          <div className="mt-3">
            {formData.image_url ? (
              <img
                src={formData.image_url}
                alt="Image Preview"
                className="w-40 h-40 object-cover rounded border"
              />
            ) : ("")}
          </div>
        </span>
      </div>
      
      <div>
        <Label>Price Ranges *</Label>
        <div className="space-y-2">
          {(formData.price_ranges ?? []).map((range, index) => (
            <div key={index} className="grid grid-cols-4 gap-2 items-end">
              <div>
                <Label>Min Qty</Label>
                <Input
                  type="number"
                  min="1"
                  value={range.min}
                  onChange={(e) =>
                    handlePriceRangeChange(
                      index,
                      "min",
                      parseInt(e.target.value) || 0
                    )
                  }
                />
              </div>
              <div>
                <Label>Max Qty</Label>
                <Input
                  type="number"
                  min="1"
                  value={range.max}
                  onChange={(e) =>
                    handlePriceRangeChange(
                      index,
                      "max",
                      parseInt(e.target.value) || 0
                    )
                  }
                />
              </div>
              <div>
                <Label>Price (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={range.price}
                  onChange={(e) =>
                    handlePriceRangeChange(
                      index,
                      "price",
                      parseFloat(e.target.value) || 0
                    )
                  }
                />
              </div>

              <Button
                type="button"
                variant="destructive"
                onClick={() => removePriceRange(index)}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={addPriceRange}
            className="mt-2"
          >
            + Add Price Range
          </Button>
        </div>
      </div>

      <div>
        <div className='flex justify-around items-center mb-2'>
        <Label className='flex-1'>Media (Images / YouTube Videos)</Label>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setFormData((prev) => ({
                ...prev,
                media: [...(prev.media ?? []), { type: 'image', url: '' }],
              }))
            }
          >
            + Add Media
          </Button>
        </div>
        <div className="space-y-4 mt-2">
          {(formData.media ?? []).map((item, index) => (
            <div key={index} className="flex items-center gap-2">
            <Label>Media Type</Label>
              <Select
                value={item.type}
                onValueChange={(value) => {
                  const updated = [...(formData.media ?? [])];
                  updated[index].type = value as 'image' | 'video';
                  setFormData((prev) => ({ ...prev, media: updated }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select media type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="text"
                value={item.url}
                placeholder="Enter URL"
                onChange={(e) => {
                  const updated = [...(formData.media ?? [])];
                  updated[index].url = e.target.value;
                  setFormData((prev) => ({ ...prev, media: updated }));
                }}
              />
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  const updated = [...(formData.media ?? [])];
                  updated.splice(index, 1);
                  setFormData((prev) => ({ ...prev, media: updated }));
                }}
              >
                Remove
              </Button>
            </div>
          ))}

        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit">{isEdit ? "Update Product" : "Add Product"}</Button>
      </div>
    </form>
    </div>
  );
};

const AdminProducts = () => {

const navigate = useNavigate();
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
    image_url: '',
    category: '',
    availability: 'In Stock',
    gross_profit: 0,
    sku_id: "",
    cost_price: 0,
    mrp:0,
    price_ranges: [
      {
        min: 1,
        max: 100,
        price: 100
      }
    ],
    media:[]
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
    setFilteredProducts(filtered);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name ) {
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
      price_ranges: formData.price_ranges ?? [],
      media: formData.media ?? null,
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
      image_url: product.image_url || '',
      availability: product.availability || 'In Stock',
      gross_profit:product.gross_profit||0,
      sku_id:product.sku_id||'',
      category:product.category ||'',
      media:product.media || [],
      info_link:product.info_link||'',
      cost_price:product.cost_price||0,
      mrp:product.mrp||0,
      price_ranges: product.price_ranges?.length
      ? product.price_ranges
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
      gross_profit:0,
      sku_id:'',
      category:'',
      media:[],
      info_link:'',
      cost_price:0,
      mrp:0,
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

  console.log(products)
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
                        {product.availability || 'Unknown'}
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
              ):(
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
                <p className="text-sm font-medium text-muted-foreground">Price Ranges:</p>
                {product.price_ranges?.length ? (
                  product.price_ranges.map((range, index) => (
                    <p key={index} className="text-sm">
                      {range.min} – {range.max} units: ₹{range.price}
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground italic">No pricing info</p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation(); // 👈 Prevent card click
                    openEditModal(product)}}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>

                {/* {product.info_link && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-blue-600 hover:text-blue-800"
                    onClick={() => window.open(product.info_link as string, "_blank")}
                  >
                    View Info
                  </Button>
                )} */}

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation(); // 👈 Prevent card click
                    deleteProduct(product.id)}}
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