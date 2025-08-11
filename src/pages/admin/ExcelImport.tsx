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
                newSale[internalKey] = value;
                break;
              }
            }
          }
          
          // **FIXED**: Robust date parsing to prevent crashes
          if (newSale.date) {
            try {
              // The 'cellDates: true' option often provides a JS Date object directly
              const dateObj = new Date(newSale.date);
              // Check if the date is valid
              if (isNaN(dateObj.getTime())) {
                  throw new Error('Invalid date value');
              }
              // Format to YYYY-MM-DD
              newSale.date = dateObj.toISOString().split('T')[0];
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
        alert("Failed to parse the Excel file. Please ensure it's a valid format.");
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
