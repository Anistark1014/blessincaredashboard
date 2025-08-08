// supabase/functions/update-reseller/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // Or your specific frontend URL for better security
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { userId, updates } = await req.json();

    if (!userId || !updates) {
      return new Response(JSON.stringify({ error: "Missing userId or updates payload." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // Create a Supabase client with the service_role key to bypass RLS
    const supabase = createClient(
      Deno.env.get("PROJECT_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    // Prepare the data for the auth update.
    // We separate the email from other metadata.
    const authUpdates: { email?: string; user_metadata?: any } = {};
    if (updates.email) {
      authUpdates.email = updates.email;
    }
    
    // All other editable fields go into user_metadata.
    // The trigger will read from here.
    authUpdates.user_metadata = {
      name: updates.name,
      region: updates.region,
      sub_region: updates.sub_region,
      coverage: updates.coverage,
      // Add any other fields from your public.users table that are editable here
    };

    // Use the admin client to update the user in the auth schema
    const { data: updatedUser, error: authError } = await supabase.auth.admin.updateUserById(
      userId,
      authUpdates
    );

    if (authError) {
      console.error("Deno Function: Auth user update error:", authError);
      throw authError;
    }

    // IMPORTANT: We do NOT manually update the public.users table here.
    // A new trigger (on_auth_user_updated) will handle that automatically.

    return new Response(JSON.stringify({ success: true, data: updatedUser }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err: any) {
    console.error("Deno Function: Unexpected Error:", err.message);
    return new Response(JSON.stringify({ error: "Internal Server Error", detail: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
