import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';

// Define the required internal keys and the possible header names for each
const HEADER_ALIASES: { [key: string]: string[] } = {
  date: ['date', 'order date', 'sale date'],
  member: ['members', 'member', 'customer', 'customer name', 'reseller'],
  product: ['product', 'product name', 'item', 'brand'],
  qty: ['qty', 'quantity', 'units', 'q'],
  price: ['price per pack', 'price', 'unit price', 'rate'],
  paid: ['paid', 'amount paid', 'paid amount'],
};

interface ExcelImportProps {
  onDataParsed: (data: any[]) => void;
  Sale: any;
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
        const workbook = XLSX.read(data, { type: 'array' });
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
          
          // Convert Excel's numeric date format to 'YYYY-MM-DD'
          if (newSale.date) {
            const excelDate = new Date(Math.round((newSale.date - 25569) * 86400 * 1000));
            newSale.date = excelDate.toISOString().split('T')[0];
          }
          
          return newSale;
        });

        onDataParsed(parsedData);

      } catch (error) {
        console.error("Error parsing Excel file:", error);
        alert("Failed to parse the Excel file. Please ensure it contains the required columns.");
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
      <Button onClick={handleButtonClick} variant="outline" className="bg-blue-500 hover:bg-blue-600 text-white">
        📥 Import
      </Button>
    </>
  );
};

export default ExcelImport;