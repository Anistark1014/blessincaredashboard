import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

// Define the required internal keys and the possible header names for each
const HEADER_ALIASES: { [key: string]: string[] } = {
  name: ['name', 'product name'],
  description: ['description', 'desc'],
  image_url: ['image', 'image url', 'image_url', 'img'],
  category: ['category', 'cat'],
  availability: ['availability', 'status'],
  gross_profit: ['gross profit', 'profit', 'gross_profit'],
  sku_id: ['sku', 'sku id', 'sku_id'],
  cost_price: ['cost price', 'cost', 'cost_price'],
  mrp: ['mrp', 'm.r.p.', 'max retail price'],
  inventory: ['inventory', 'stock', 'qty', 'quantity'],
  price_ranges: ['price ranges', 'price_ranges', 'pricing'],
  media: ['media', 'media links', 'images'],
  info_link: ['info link', 'info_link', 'link'],
};


interface ProductExcelImportProps {
  onDataParsed: (data: any[]) => void;
  products?: any[]; // Optional: for export
}


const ProductExcelImport: React.FC<ProductExcelImportProps> = ({ onDataParsed, products }) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Export handler
  const handleExport = () => {
    if (!products || products.length === 0) {
      toast({
        title: "No Data",
        description: "No products to export.",
        variant: "destructive",
      });
      return;
    }
    // Remove fields that shouldn't be exported (like internal DB ids)
    const exportData = products.map(({ id, created_at, ...rest }) => {
      // Ensure price_ranges and media are exported as JSON strings if present
      return {
        ...rest,
        price_ranges: rest.price_ranges ? (typeof rest.price_ranges === 'string' ? rest.price_ranges : JSON.stringify(rest.price_ranges)) : '',
        media: rest.media ? (typeof rest.media === 'string' ? rest.media : JSON.stringify(rest.media)) : '',
        inventory: rest.inventory ?? '',
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    XLSX.writeFile(workbook, 'products_export.xlsx');
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet);

        // Map and then sort products in reverse alphabetical order by name
        const parsedData = json.map(row => {
          const newProduct: { [key: string]: any } = {};
          for (const [excelHeader, value] of Object.entries(row)) {
            const lowerCaseHeader = excelHeader.toLowerCase().trim();
            for (const [internalKey, aliases] of Object.entries(HEADER_ALIASES)) {
              if (aliases.includes(lowerCaseHeader)) {
                // Handle JSON string fields
                if ((internalKey === 'price_ranges' || internalKey === 'media') && typeof value === 'string' && value.trim()) {
                  try {
                    newProduct[internalKey] = JSON.parse(value);
                  } catch {
                    newProduct[internalKey] = value; // Keep as string if JSON parse fails
                  }
                }
                // Handle numeric fields - convert empty strings to null
                else if (['gross_profit', 'cost_price', 'mrp', 'inventory'].includes(internalKey)) {
                  if (value === '' || value === null || value === undefined) {
                    newProduct[internalKey] = null;
                  } else {
                    const num = Number(value);
                    newProduct[internalKey] = isNaN(num) ? null : num;
                  }
                }
                // Handle other fields normally
                else {
                  newProduct[internalKey] = value === '' ? null : value;
                }
                break;
              }
            }
          }
          return newProduct;
        });

        // Sort in reverse alphabetical order by name
        const sortedData = parsedData.sort((a, b) => {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          return nameB.localeCompare(nameA);
        });

        onDataParsed(sortedData as any[]);
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        toast({
          title: "Parse Error",
          description: "Failed to parse the Excel file. Please ensure it's a valid format.",
          variant: "destructive",
        });
      }
    };

    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        accept=".xlsx, .xls, .csv"
      />
      <TooltipProvider>
        <div className="flex gap-2">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button data-command-import-btn onClick={handleButtonClick} variant="ghost" size="icon" aria-label="Import Products">
                <Download className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Import Products (Excel)</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button data-command-export-btn onClick={handleExport} variant="ghost" size="icon" aria-label="Export Products">
                <Download className="h-5 w-5 rotate-180" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Export Products (Excel)</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </>
  );
};

export default ProductExcelImport;
