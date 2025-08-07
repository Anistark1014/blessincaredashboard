// supabase/functions/edit-profile/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    console.log("=== Incoming edit-profile request ===");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Missing or invalid auth token");
      return new Response(JSON.stringify({ error: "Missing or invalid auth token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const accessToken = authHeader.replace("Bearer ", "");
    console.log("Access token received.");

    const PROJECT_URL = Deno.env.get("PROJECT_URL")!;
    const ANON_KEY = Deno.env.get("ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;

    console.log("Env variables loaded.");

    const supabaseUser = createClient(PROJECT_URL, ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const supabaseService = createClient(PROJECT_URL, SERVICE_ROLE_KEY);

    const { updates } = await req.json();
    console.log("Request body parsed:", updates);

    if (!updates) {
      return new Response(JSON.stringify({ error: "Missing updates object" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      console.error("Failed to get logged-in user:", userError);
      return new Response(JSON.stringify({ error: "Failed to get user" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const userId = user.id;
    console.log("Authenticated user ID:", userId);

    const { error: authError } = await supabaseUser.auth.updateUser({
      email: updates.email,
      data: {
        name: updates.name,
        region: updates.region,
      },
    });

    if (authError) {
      console.error("Error updating auth user:", authError);
      throw authError;
    }

    console.log("Auth user updated successfully.");

    const { error: dbError } = await supabaseService
      .from("users")
      .update({
        name: updates.name,
        email: updates.email,
        region: updates.region,
      })
      .eq("id", userId);

    if (dbError) {
      console.error("Error updating users table:", dbError);
      throw dbError;
    }

    console.log("Users table updated successfully.");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err: any) {
    console.error("Unexpected error caught in catch block:", err.message);
    return new Response(
      JSON.stringify({ error: "Unexpected Error", detail: err.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }
});
