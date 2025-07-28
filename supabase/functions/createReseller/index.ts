// supabase/functions/createReseller/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("OK", { status: 200, headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();
    const { name, email, phone, region, coverage } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return new Response(JSON.stringify({ error: "Missing or invalid 'name' field." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const supabase = createClient(
      Deno.env.get("PROJECT_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    const uniqueSuffix = crypto.randomUUID().substring(0, 8);
    const authUserEmail = (email && email.trim()) 
      ? email.trim() 
      : `${name.toLowerCase().replace(/\s/g, '.')}.${uniqueSuffix}@autogen.yourdomain.com`;
    
    const cleanedNameForPass = name.trim().replace(/\s+/g, '').toLowerCase();
    const generatedPassword = `${cleanedNameForPass.charAt(0).toUpperCase()}${cleanedNameForPass.slice(1)}@123`;

    // --- ✅ THE FIX: Use a simpler, more direct 'user_metadata' object ---
    // This is the standard and most reliable way to pass data to the trigger.
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: authUserEmail,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: {
        name: name.trim(),
        email: (email && email.trim()) ? email.trim() : null,
        phone: (phone && phone.trim()) ? phone.trim() : null,
        region: (region && region.trim()) ? region.trim() : null,
        coverage: coverage || 0,
        role: 'reseller',
      }
    });

    if (authError) {
      console.error("Deno Function: Auth user creation error:", authError);
      throw authError;
    }

    console.log(`Deno Function: Auth user created successfully. ID: ${authUser.user.id}`);

    return new Response(JSON.stringify({
      success: true,
      message: "Reseller added successfully!",
      generated_password: generatedPassword,
      auth_user_email: authUserEmail
    }), {
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
