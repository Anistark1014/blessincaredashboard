import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import { Download, Upload } from 'lucide-react'; // Using a more descriptive icon
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast";

// Define the required internal keys and the possible header names for each
const HEADER_ALIASES: { [key: string]: string[] } = {
  date: ['date', 'order date', 'sale date'],
  member: ['member', 'members', 'customer', 'customer name', 'reseller'], // Corrected to match main component
  product: ['product', 'product name', 'item', 'brand'],
  qty: ['qty', 'quantity', 'units', 'q'],
  price: ['price per pack', 'price', 'unit price', 'rate'],
  paid: ['paid', 'amount paid', 'paid amount'],
};

interface ExcelImportProps {
  onDataParsed: (data: any[]) => void;
}

const ExcelImport: React.FC<ExcelImportProps> = ({ onDataParsed }) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        const workbook = XLSX.read(data, { type: 'array', cellDates: true }); // Use cellDates for better parsing
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet);

        // Smart mapping logic
        const parsedData = json.map(row => {
          const newSale: { [key: string]: any } = {};
          for (const [excelHeader, value] of Object.entries(row)) {
            const lowerCaseHeader = excelHeader.toLowerCase().trim();
            for (const [internalKey, aliases] of Object.entries(HEADER_ALIASES)) {
              if (aliases.includes(lowerCaseHeader)) {
                if (internalKey === 'price') {
                  // Only set price if it's a valid number
                  const num = Number(value);
                  newSale[internalKey] = (value === '' || value === null || value === undefined || isNaN(num)) ? null : num;
                } else {
                  newSale[internalKey] = value;
                }
                break;
              }
            }
          }
          
          // **FIXED**: Robust date parsing to prevent crashes
            if (newSale.date) {
              try {
                let formattedDate = null;
                if (newSale.date instanceof Date) {
                  // Manually add 1 day to fix offset
                  const fixedDate = new Date(newSale.date.getTime() + 24 * 60 * 60 * 1000);
                  const year = fixedDate.getUTCFullYear();
                  const month = String(fixedDate.getUTCMonth() + 1).padStart(2, '0');
                  const day = String(fixedDate.getUTCDate()).padStart(2, '0');
                  formattedDate = `${year}-${month}-${day}`;
                } else if (typeof newSale.date === 'number') {
                  // Excel sometimes gives dates as numbers (days since 1900)
                  // Use XLSX to parse and add 1 day
                  const excelDate = XLSX.SSF.parse_date_code(newSale.date + 1);
                  if (excelDate) {
                    const year = excelDate.y;
                    const month = String(excelDate.m).padStart(2, '0');
                    const day = String(excelDate.d).padStart(2, '0');
                    formattedDate = `${year}-${month}-${day}`;
                  }
                } else if (typeof newSale.date === 'string') {
                  // Try to parse string as YYYY-MM-DD or DD/MM/YYYY
                  const dateStr = newSale.date.trim();
                  // If already in YYYY-MM-DD, keep as is
                  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    formattedDate = dateStr;
                  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
                    // Convert DD/MM/YYYY to YYYY-MM-DD
                    const [day, month, year] = dateStr.split('/');
                    formattedDate = `${year}-${month}-${day}`;
                  } else {
                    // Fallback: try Date parsing and add 1 day
                    const dateObj = new Date(dateStr);
                    if (!isNaN(dateObj.getTime())) {
                      const fixedDate = new Date(dateObj.getTime() + 24 * 60 * 60 * 1000);
                      const year = fixedDate.getUTCFullYear();
                      const month = String(fixedDate.getUTCMonth() + 1).padStart(2, '0');
                      const day = String(fixedDate.getUTCDate()).padStart(2, '0');
                      formattedDate = `${year}-${month}-${day}`;
                    }
                  }
                }
                if (!formattedDate) throw new Error('Invalid date value');
                newSale.date = formattedDate;
              } catch (dateError) {
                console.warn(`Could not parse date for row, skipping:`, row);
                return null; // Skip rows with invalid dates
              }
            }
          
          return newSale;
        }).filter(Boolean); // Filter out any null (skipped) rows

        onDataParsed(parsedData as any[]);

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
  <Tooltip delayDuration={0}> {/* <--- Add this prop */}
    <TooltipTrigger asChild>
      <Button onClick={handleButtonClick} variant="outline" size="sm" data-command-import-btn>
        <Download className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Import Sales</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
    </>
  );
};

export default ExcelImport;
