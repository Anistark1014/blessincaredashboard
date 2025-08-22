import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import { Download, Upload } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

// Define the required internal keys and the possible header names for each
const HEADER_ALIASES: { [key: string]: string[] } = {
  tier: ['tier', 'reward tier', 'level'],
  title: ['title', 'reward title', 'name', 'reward name'],
  description: ['description', 'desc', 'details'],
  points_required: ['points required', 'points_required', 'points', 'cost'],
  is_active: ['is active', 'is_active', 'active', 'status'],
  link: ['link', 'reward link', 'url', 'claim link'],
  image_url: ['image url', 'image_url', 'image', 'img', 'picture'],
};

interface RewardExcelImportProps {
  onDataParsed: (data: any[]) => void;
  rewards?: any[]; // Optional: for export
}

const RewardExcelImport: React.FC<RewardExcelImportProps> = ({ onDataParsed, rewards }) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export handler
  const handleExport = () => {
    if (!rewards || rewards.length === 0) {
      toast({
        title: "No Data",
        description: "No rewards to export.",
        variant: "destructive",
      });
      return;
    }
    
    // Remove fields that shouldn't be exported (like internal DB ids)
    const exportData = rewards.map(({ id, created_at, ...rest }) => ({
      ...rest,
      is_active: rest.is_active ? 'Yes' : 'No', // Convert boolean to readable format
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rewards');
    XLSX.writeFile(workbook, 'rewards_export.xlsx');
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

        // Smart mapping logic
        const parsedData = json.map(row => {
          const newReward: { [key: string]: any } = {};
          
          for (const [excelHeader, value] of Object.entries(row)) {
            const lowerCaseHeader = excelHeader.toLowerCase().trim();
            for (const [internalKey, aliases] of Object.entries(HEADER_ALIASES)) {
              if (aliases.includes(lowerCaseHeader)) {
                // Handle numeric fields
                if (internalKey === 'points_required') {
                  if (value === '' || value === null || value === undefined) {
                    newReward[internalKey] = 0;
                  } else {
                    const num = Number(value);
                    newReward[internalKey] = isNaN(num) ? 0 : num;
                  }
                }
                // Handle boolean fields
                else if (internalKey === 'is_active') {
                  if (typeof value === 'boolean') {
                    newReward[internalKey] = value;
                  } else if (typeof value === 'string') {
                    const lowerValue = value.toLowerCase().trim();
                    newReward[internalKey] = ['yes', 'true', '1', 'active'].includes(lowerValue);
                  } else {
                    newReward[internalKey] = true; // Default to active
                  }
                }
                // Handle other fields normally
                else {
                  newReward[internalKey] = value === '' ? null : value;
                }
                break;
              }
            }
          }
          
          // Set defaults for required fields if not provided
          if (!newReward.tier) newReward.tier = 'Base';
          if (!newReward.title) newReward.title = '';
          if (!newReward.description) newReward.description = '';
          if (newReward.points_required === undefined) newReward.points_required = 0;
          if (newReward.is_active === undefined) newReward.is_active = true;
          
          return newReward;
        });

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
        <div className="flex gap-2">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button 
                data-command-import-btn 
                onClick={handleButtonClick} 
                variant="outline" 
                size="sm" 
                aria-label="Import Rewards"
              >
                <Download className="h-4 w-4 mr-2" />
                Import
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Import Rewards (Excel)</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button 
                data-command-export-btn 
                onClick={handleExport} 
                variant="outline" 
                size="sm" 
                aria-label="Export Rewards"
              >
                <Upload className="h-4 w-4 mr-2" />
                Export
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Export Rewards (Excel)</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </>
  );
};

export default RewardExcelImport;
