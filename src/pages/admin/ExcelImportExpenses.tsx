import * as React from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const ExcelImportExpenses = ({ onDataParsed }: { onDataParsed: (data: any[]) => void }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      try {
        if (event.target && event.target.result) {
          const data = new Uint8Array(event.target.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);
          onDataParsed(json);
        }
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        // You can add a toast notification for the user here
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset file input
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          data-command-import-btn
          onClick={handleButtonClick}
        >
          <Download className="h-4 w-4" />
          <input 
            id="excel-upload" 
            type="file" 
            accept=".xlsx, .xls" 
            className="hidden" 
            onChange={handleFileChange} 
            ref={fileInputRef}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent><p>Import from Excel</p></TooltipContent>
    </Tooltip>
  );
};


export default ExcelImportExpenses;