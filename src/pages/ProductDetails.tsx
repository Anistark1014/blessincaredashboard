import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PriceRange {
  min: number;
  max: number;
  price: number;
}

interface MediaItem {
  type: "image" | "video";
  url: string;
}

interface Product {
  id: string;
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
}

const ProductDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching product:", error);
      } else {
        setProduct(data as Product);
      }
      setLoading(false);
    };

    fetchProduct();
  }, [id]);

  if (loading || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
console.log(product)
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Top Section: Image + Basic Info */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Product Image */}
        <div className="flex-1 max-w-md mx-auto lg:mx-0">
          <p className="text-muted-foreground mb-2">SKU: {product.sku_id || "N/A"}</p>
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="rounded-lg w-full object-cover max-h-96"
            />
          ) : (
            <div className="w-full h-96 bg-muted flex items-center justify-center text-muted-foreground rounded-lg">
              No Image Available
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="flex-1 space-y-3">
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <p className="text-muted-foreground">
            Availability: {product.availability || "Unknown"}
          </p>
          <p className="text-muted-foreground">
            Category: {product.category || "Unknown"}
          </p>
          <p className="text-muted-foreground">MRP: ₹{product.mrp?.toFixed(2)}</p>
          <p className="text-muted-foreground">
            Cost Price: ₹{product.cost_price?.toFixed(2) || "N/A"}
          </p>
          <p className="text-muted-foreground">
            Gross Profit: ₹{product.gross_profit?.toFixed(2) || "N/A"}
          </p>
            {product.info_link && (
              <Button
                variant="outline"
                size="sm"
                className="text-blue-600 hover:text-blue-800"
                onClick={() => window.open(product.info_link as string, "_blank")}
              >
                View Info
              </Button>
            )}
        </div>
      </div>

      {/* Description */}
      {product.description && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Description</h2>
          <p className="text-muted-foreground">{product.description}</p>
        </div>
      )}

      {/* Price Ranges */}
      {product.price_ranges && product.price_ranges.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Price Ranges</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-border rounded-md">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 border border-border text-left">Min Qty</th>
                  <th className="px-4 py-2 border border-border text-left">Max Qty</th>
                  <th className="px-4 py-2 border border-border text-left">Price (₹)</th>
                </tr>
              </thead>
              <tbody>
                {product.price_ranges.map((range, index) => (
                  <tr key={index} className="border-t border-border">
                    <td className="px-4 py-2">{range.min}</td>
                    <td className="px-4 py-2">{range.max}</td>
                    <td className="px-4 py-2">₹{range.price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Media Section */}
      {product.media && product.media.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Media</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {product.media.map((item, index) => (
              <Card key={index} className="p-2 overflow-hidden">
                {item.type === "image" ? (
                  <img
                    src={item.url}
                    alt={`media-${index}`}
                    className="rounded w-full h-52 object-cover"
                  />
                ) : (
                  <iframe
                    src={item.url}
                    title={`video-${index}`}
                    className="w-full h-52 rounded"
                    allowFullScreen
                  />
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetails;
