export interface ShrinkageLog {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  date: string;
  notes: string | null;
}

export const shrinkageLogs: ShrinkageLog[] = [];
