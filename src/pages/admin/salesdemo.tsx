// SalesPage.tsx
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Database } from "@/types/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

// Type for sales row
type Sale = Database["public"]["Tables"]["sales"]["Row"];
type NewSale = Omit<Sale, "id">;

const defaultNewSale: NewSale = {
  date: "",
  type: "",
  member: "",
  brand: "",
  qty: 0,
  price: 0,
  total: 0,
  paid: 0,
  incoming: 0,
  clearance: "",
  status: "",
  description: ""
};

export default function SalesPage() {
  const [salesData, setSalesData] = useState<Sale[]>([]);
  const [newSale, setNewSale] = useState<NewSale>(defaultNewSale);

  // Fetch sales records on mount
  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    const { data, error } = await supabase.from("sales").select("*").order("date", { ascending: false });
    if (error) console.error("Fetch error:", error.message);
    else setSalesData(data);
  };

  // Handle input change
  const handleChange = (field: keyof NewSale, value: any) => {
    setNewSale((prev) => ({ ...prev, [field]: value }));
  };

  // Insert new sale
  const saveRecord = async () => {
    const { data, error } = await supabase.from("sales").insert([newSale]).select();
    if (error) {
      console.error("Insert failed:", error.message);
    } else if (data) {
      setSalesData((prev) => [data[0], ...prev]);
      setNewSale(defaultNewSale);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-xl font-bold">Add New Sale</h2>
      <div className="grid grid-cols-4 gap-2">
        <Input
          placeholder="Date"
          value={newSale.date}
          onChange={(e) => handleChange("date", e.target.value)}
        />
        <Input
          placeholder="Type"
          value={newSale.type}
          onChange={(e) => handleChange("type", e.target.value)}
        />
        <Input
          placeholder="Member"
          value={newSale.member}
          onChange={(e) => handleChange("member", e.target.value)}
        />
        <Input
          placeholder="Brand"
          value={newSale.brand}
          onChange={(e) => handleChange("brand", e.target.value)}
        />
        <Input
          placeholder="Qty"
          type="number"
          value={newSale.qty}
          onChange={(e) => handleChange("qty", Number(e.target.value))}
        />
        <Input
          placeholder="Price"
          type="number"
          value={newSale.price}
          onChange={(e) => handleChange("price", Number(e.target.value))}
        />
        <Input
          placeholder="Total"
          type="number"
          value={newSale.total}
          onChange={(e) => handleChange("total", Number(e.target.value))}
        />
        <Input
          placeholder="Paid"
          type="number"
          value={newSale.paid}
          onChange={(e) => handleChange("paid", Number(e.target.value))}
        />
        <Input
          placeholder="Incoming"
          type="number"
          value={newSale.incoming}
          onChange={(e) => handleChange("incoming", Number(e.target.value))}
        />
        <Input
          placeholder="Clearance"
          value={newSale.clearance}
          onChange={(e) => handleChange("clearance", e.target.value)}
        />
        <Input
          placeholder="Status"
          value={newSale.status}
          onChange={(e) => handleChange("status", e.target.value)}
        />
        <Input
          placeholder="Description"
          value={newSale.description}
          onChange={(e) => handleChange("description", e.target.value)}
        />
      </div>
      <Button onClick={saveRecord}>Save</Button>

      <h2 className="text-xl font-bold mt-10">Sales Records</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead>
            <tr className="bg-gray-100">
              {Object.keys(defaultNewSale).map((key) => (
                <th key={key} className="border px-2 py-1 text-left capitalize">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {salesData.map((sale, i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                {Object.keys(defaultNewSale).map((key) => (
                  <td key={key} className="border px-2 py-1">
                    {sale[key as keyof Sale]?.toString() || ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
