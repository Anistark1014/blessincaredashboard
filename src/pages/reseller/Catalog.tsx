import { useEffect, useState } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Package, Search, ShoppingCart, Heart, ArrowRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';

interface PriceRange {
  min: number;
  max: number;
  price: number;
}

interface Product {
  id?: string;
  name: string;
  description?: string;
  availability?: string;
  created_at?: string;
  image_url?: string;
  price_ranges?: PriceRange[];
}

const ProductCatalog = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  // Removed unused categoryFilter
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectedProductQuantities, setSelectedProductQuantities] = useState<Map<string, number>>(new Map());
  const { toast } = useToast();

  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase.from('products').select('*');
      if (error) {
        console.error('Error fetching products:', error);
      } else {
        // Convert price_ranges to PriceRange[] if possible
        const safeProducts = (data || []).map((prod) => ({
          ...prod,
          description: prod.description ?? undefined,
          category: prod.category ?? undefined,
          availability: prod.availability ?? undefined,
          created_at: prod.created_at ?? undefined,
          image_url: prod.image_url ?? undefined,
          price_ranges: Array.isArray(prod.price_ranges)
            ? (prod.price_ranges as unknown as PriceRange[])
            : undefined,
        }));
        setProducts(safeProducts as Product[]);
      }
      setLoading(false);
    };

    fetchProducts();
  }, []);

  const filteredProducts = products.filter(product => {
    const matchesAvailability = availabilityFilter === 'all' || product.availability === availabilityFilter;

    return matchesAvailability;
  });


  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'in-stock': return 'status-success';
      case 'low-stock': return 'status-warning';
      case 'out-of-stock': return 'status-error';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => {
      const updated = new Set(prev);
      if (updated.has(productId)) {
        updated.delete(productId);
      } else {
        updated.add(productId);
      }
      return updated;
    });

    setSelectedProductQuantities(prev => {
      const updated = new Map(prev);
      if (updated.has(productId)) {
        updated.delete(productId);
      } else {
        updated.set(productId, 1);
      }
      return updated;
    });
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    setSelectedProductQuantities(prev => {
      const updated = new Map(prev);
      updated.set(productId, quantity);
      return updated;
    });
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

      const itemsToInsert = products
  .filter((p) => p.id && selectedProducts.has(p.id!))
  .map((p) => {
    const quantity = selectedProductQuantities.get(p.id!) || 1;

    // Determine the correct price based on quantity
    const matchingRange = Array.isArray(p.price_ranges)
      ? p.price_ranges.find((range) => quantity >= range.min && quantity <= range.max)
      : undefined;

    const price = matchingRange ? matchingRange.price : 0;

    return {
      request_id: request.id,
      product_id: p.id,
      product_name: p.name,
      quantity,
      price: quantity * price, // total price for this item
    };
  });

console.log("ItemsToInsert", itemsToInsert);

const { error: itemsError } = await supabase
  .from('product_request_items')
  .insert(itemsToInsert);

      if (itemsError) throw itemsError;

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
      setSelectedProductQuantities(new Map());
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
        <CardContent className="-mb-6">
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
          </div>
        </CardContent>
      </Card>

        {/* Products Grid */} 
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => {
            const isSelected = selectedProducts.has(product.id!);
            const isOutOfStock = product.availability === 'out-of-stock';

            return (
              <Card
                key={product.id}
                className={`healthcare-card cursor-pointer transition-all duration-300 ${
                  isSelected ? 'ring-2 ring-lavender shadow-[var(--shadow-floating)]' : ''
                } ${isOutOfStock ? 'opacity-60' : ''}`}
                onClick={() => !isOutOfStock && toggleProductSelection(product.id!)}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <Badge className={getAvailabilityColor(product.availability!)}>
                      {product.availability!.replace('-', ' ')}
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
                    {product.image_url == null || product.image_url == '' ? (
                      <div>
                        <Package className="w-12 h-12 text-lavender-dark opacity-50" />
                      </div>
                    ) : (
                      <div>
                        <img src={product.image_url} className="w-40 h-40" alt="" />
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div>
                    <CardTitle className="text-lg text-foreground">{product.name}</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                      {product.description}
                    </CardDescription>
                  </div>

                  <div className="pt-2 border-t border-border/40 space-y-1">
                    {Array.isArray(product.price_ranges) && product.price_ranges.length > 0 ? (
                      product.price_ranges.map((range, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center text-sm text-muted-foreground"
                        >
                          <span className="font-semibold text-foreground">₹{range.price}</span>
                          <span className="text-xs">(Qty: {range.min} - {range.max})</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-foreground">No Price Info</div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2">
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
                        toggleProductSelection(product.id!);
                      }}
                    >
                      {isOutOfStock ? 'Out of Stock' : isSelected ? 'Selected' : 'Select'}
                    </Button>
                  </div>

                  {isSelected && (
                    <div className="pt-2 flex items-center gap-2">
                      <label htmlFor={`qty-${product.id}`} className="text-sm text-muted-foreground">
                        Qty:
                      </label>
                      <Input
                        id={`qty-${product.id}`}
                        type="number"
                        min={5}
                        value={selectedProductQuantities.get(product.id!) || 1}
                        onChange={(e) =>
                          handleQuantityChange(product.id!, parseInt(e.target.value) || 1)
                        }
                        className="w-28 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
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
