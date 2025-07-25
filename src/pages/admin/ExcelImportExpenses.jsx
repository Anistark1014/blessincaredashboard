import React from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const ExcelImportExpenses = ({ onDataParsed }) => {
  const fileInputRef = React.useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        onDataParsed(json);
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        // You can add a toast notification for the user here
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset file input
  };

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Button asChild variant="outline" size="icon">
          <label htmlFor="excel-upload" className="cursor-pointer inline-flex items-center justify-center">
            <Download className="h-4 w-4" />
            <input 
              id="excel-upload" 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              onChange={handleFileChange} 
              ref={fileInputRef}
            />
          </label>
        </Button>
      </TooltipTrigger>
      <TooltipContent><p>Import from Excel</p></TooltipContent>
    </Tooltip>
  );
};

export default ExcelImportExpenses;