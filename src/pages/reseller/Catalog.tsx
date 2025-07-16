import { useEffect, useState } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '@/components/ui/select';
import {
  Package, Search, Filter, ShoppingCart, Heart, Star, ArrowRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  availability: 'in-stock' | 'low-stock' | 'out-of-stock';
};

const ProductCatalog = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase.from('products').select('*');
      if (error) {
        console.error('Error fetching products:', error);
      } else {
        setProducts(data as Product[]);
      }
      setLoading(false);
    };

    fetchProducts();
  }, []);

  const filteredProducts = products.filter(product => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    const matchesAvailability = availabilityFilter === 'all' || product.availability === availabilityFilter;

    return matchesSearch && matchesCategory && matchesAvailability;
  });

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))];

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'in-stock': return 'status-success';
      case 'low-stock': return 'status-warning';
      case 'out-of-stock': return 'status-error';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const toggleProductSelection = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    newSelected.has(productId) ? newSelected.delete(productId) : newSelected.add(productId);
    setSelectedProducts(newSelected);
  };

const handleRequestProducts = async () => {
  if (selectedProducts.size === 0) {
    toast({
      title: "No products selected",
      description: "Please select at least one product to request.",
      variant: "destructive",
    });
    return;
  }

  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    if (!userId) {
      toast({
        title: "Unauthorized",
        description: "You must be logged in to request products.",
        variant: "destructive",
      });
      return;
    }

    // 1. Create product_request entry
    const { data: request, error: requestError } = await supabase
      .from('requests')
      .insert({
        reseller_id: userId,
        status: 'pending',
        request_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (requestError) throw requestError;

    // 2. Create product_request_items entries
    const itemsToInsert = products
      .filter((p) => selectedProducts.has(p.id))
      .map((p) => ({
        request_id: request.id,
        product_id: p.id,
        product_name: p.name,
        quantity: 1, // Default 1 — can be updated if UI adds quantity input
        price: p.price,
      }));

    const { error: itemsError } = await supabase
      .from('product_request_items')
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    // 3. Optional: Create a notification
    await supabase.from('notifications').insert({
      user_id: userId,
      message: `You requested ${selectedProducts.size} product(s).`,
      type: 'info',
      timestamp: new Date().toISOString(),
    });

    toast({
      title: "Request Submitted",
      description: `${selectedProducts.size} products requested successfully.`,
      className: "border-mint bg-mint/10",
    });

    setSelectedProducts(new Set());
  } catch (err: any) {
    console.error(err);
    toast({
      title: "Request Failed",
      description: err.message || "An unexpected error occurred.",
      variant: "destructive",
    });
  }
};

console.log(products)
  return (
    <div className="space-y-6 fade-in-up">
      {/* Header */}
      <div className="healthcare-card">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Package className="w-8 h-8 text-lavender-dark" />
              Product Catalog
            </h1>
            <p className="text-muted-foreground mt-1">
              Discover our premium women's healthcare products
            </p>
          </div>
          {selectedProducts.size > 0 && (
            <Button className="btn-healthcare" onClick={handleRequestProducts}>
              <ShoppingCart className="w-4 h-4 mr-2" />
              Request {selectedProducts.size} Products
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="healthcare-card">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-lavender/30 focus:border-lavender"
              />
            </div>

            <div className="flex gap-4">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40 border-lavender/30">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
                <SelectTrigger className="w-40 border-lavender/30">
                  <SelectValue placeholder="Availability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="in-stock">In Stock</SelectItem>
                  <SelectItem value="low-stock">Low Stock</SelectItem>
                  <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product) => {
          const isSelected = selectedProducts.has(product.id);
          const isOutOfStock = product.availability === 'out-of-stock';

          return (
            <Card
              key={product.id}
              className={`healthcare-card cursor-pointer transition-all duration-300 ${
                isSelected ? 'ring-2 ring-lavender shadow-[var(--shadow-floating)]' : ''
              } ${isOutOfStock ? 'opacity-60' : ''}`}
              onClick={() => !isOutOfStock && toggleProductSelection(product.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <Badge className={getAvailabilityColor(product.availability)}>
                    {product.availability.replace('-', ' ')}
                  </Badge>
                  <div className="flex gap-1">
                    <Heart className="w-4 h-4 text-muted-foreground hover:text-blush-dark cursor-pointer float-gentle" />
                    {isSelected && (
                      <div className="w-5 h-5 bg-gradient-to-br from-lavender to-blush rounded-full flex items-center justify-center">
                        <ArrowRight className="w-3 h-3 text-lavender-foreground" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="aspect-video bg-gradient-to-br from-lavender/10 to-blush/10 rounded-lg flex items-center justify-center">
                  <Package className="w-12 h-12 text-lavender-dark opacity-50" />
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div>
                  <CardTitle className="text-lg text-foreground">{product.name}</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    {product.description}
                  </CardDescription>
                </div>

                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {product.category}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-warning fill-current" />
                    <span className="text-xs text-muted-foreground">4.8</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <div className="text-2xl font-bold text-foreground">${product.price}</div>
                  <Button
                    size="sm"
                    variant={isSelected ? 'default' : 'outline'}
                    className={
                      isSelected
                        ? 'btn-healthcare'
                        : 'border-lavender text-lavender hover:bg-lavender hover:text-lavender-foreground'
                    }
                    disabled={isOutOfStock}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleProductSelection(product.id);
                    }}
                  >
                    {isOutOfStock ? 'Out of Stock' : isSelected ? 'Selected' : 'Select'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredProducts.length === 0 && !loading && (
        <Card className="healthcare-card">
          <CardContent className="text-center py-12">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No products found</h3>
            <p className="text-muted-foreground mb-4">Try adjusting your search criteria or filters</p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('all');
                setAvailabilityFilter('all');
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProductCatalog;
