import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Tables } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Package} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
  import { useNavigate } from "react-router-dom";
  
type Product = Tables<'products'> & {
  category?: string | null;
};

const AdminProducts = () => {

const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

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


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  console.log(products)
  return (
    <div className="space-y-6 fade-in-up">
      {/* Header */}
      {/* <div className="healthcare-card">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Product Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage your healthcare product inventory with real-time updates
            </p>
          </div>
        </div>
      </div> */}

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
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
};

export default AdminProducts;