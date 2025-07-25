import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Loader2, Settings } from "lucide-react";

export const AdminSettings=()=> {
  const [allowSignup, setAllowSignup] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchSetting = async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("allow_signup")
        .eq("id", 1)
        .single();

      if (error) {
        toast({
          title: "Failed to load settings",
          description: error.message,
          variant: "destructive",
        });
        setAllowSignup(false);
      } else {
        setAllowSignup(Boolean(data.allow_signup));
      }

      setLoading(false);
    };

    fetchSetting();
  }, []);

  const handleToggle = async (checked: boolean) => {
    setUpdating(true);
    setAllowSignup(checked);

    const { error } = await supabase
      .from("settings")
      .update({ allow_signup: checked })
      .eq("id", 1);

    if (error) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
      setAllowSignup(!checked); // Revert if failed
    } else {
      toast({
        title: "Setting Updated",
        description: `Signup is now ${checked ? "enabled" : "disabled"}.`,
      });
    }

    setUpdating(false);
  };

  return (
    <Card className="healthcare-card w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-muted-foreground" />
            <CardTitle>Admin Settings</CardTitle>
          </div>
        </div>
        <CardDescription>
          These Settings will apply to all the Reseller or Admin users.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/40">
          <div className="flex flex-col">
            <p className="font-medium text-foreground">Allow Signup</p>
            <p className="text-sm text-muted-foreground">
              {allowSignup ? "Signup is currently enabled" : "Signup is currently disabled"}
            </p>
          </div>

          {loading ? (
            <Loader2 className="animate-spin w-5 h-5 text-muted-foreground" />
          ) : (
            <Switch
              checked={!!allowSignup}
              onCheckedChange={handleToggle}
              disabled={updating}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
