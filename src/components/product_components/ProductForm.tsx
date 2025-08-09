import {useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";


// Create a properly typed wrapper for ReactQuill
const QuillEditor = ReactQuill as any;

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
}


// ProductForm (kept as-is from your provided code, placed above AdminProducts)
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
                        <div className='m-4'>
                            <QuillEditor
                                theme="snow"
                                value={formData.description ?? ""}
                                onChange={(value: string) =>
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
                        <div className={cn('', isEdit ? "hidden" : "flex-1")}>
                            <Label className='mb-2' htmlFor="sku_id">SKU ID <span className='text-xs ml-2'>(BRAND-PRODUCT-TYPE-SIZE-PACKAGING)</span></Label>
                            <Input
                                id="sku_id"
                                type="text"
                                value={formData.sku_id ?? ""}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        sku_id: (e.target.value),
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
                                        info_link: (e.target.value),
                                    }))
                                }
                            />
                        </div>
                    </div>

                    <div className='flex justify-around items-center gap-4'>
                        <span className={cn('flex flex-col gap-4 ', formData.image_url ? '' : 'w-full')}>
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

export default ProductForm