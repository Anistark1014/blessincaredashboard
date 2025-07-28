import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Handle preflight (CORS) requests. This is crucial for web applications
  // making requests from a different origin than the Deno function.
  if (req.method === "OPTIONS") {
    return new Response("OK", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", // Allow requests from any origin
        "Access-Control-Allow-Headers": "Content-Type, Authorization", // Allowed headers
        "Access-Control-Allow-Methods": "POST, OPTIONS", // Allowed HTTP methods
      },
    });
  }

  try {
    // Parse the request body as JSON to extract reseller details.
    const body = await req.json();
    const { name, email, phone, region } = body;

    // Validate if all required fields are present in the request body.
    if (!email || !name || !phone || !region) {
      return new Response(JSON.stringify({ error: "Missing fields in request" }), {
        status: 400, // Bad Request
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }

    // Initialize Supabase client with project URL and Service Role Key.
    // The Service Role Key bypasses Row Level Security (RLS) and is necessary
    // for admin operations like creating users.
    // @ts-ignore - Supabase type definitions might not perfectly align with Deno.env.get
    const supabase = createClient(
      Deno.env.get("PROJECT_URL")!, // Your Supabase Project URL environment variable
      Deno.env.get("SERVICE_ROLE_KEY")! // Your Supabase Service Role Key environment variable
    );

    // Check if a user with the given email already exists in your 'users' table.
    // This prevents creating duplicate entries in your custom user profile table.
    const { data: existingUser, error: fetchError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle(); // Use maybeSingle to get null if no row found, or the single row

    if (fetchError) {
      console.error("Database fetch error checking existing user:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to check existing user" }), {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }

    if (existingUser) {
      return new Response(JSON.stringify({ error: "User with this email already exists" }), {
        status: 400, // Bad Request
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }

    // --- IMPORTANT: Password Generation Improvement ---
    // Generate a random, strong password for the Supabase Auth user.
    // This password will be stored in the auth.users table.
    // It's crucial that this password meets Supabase's complexity requirements.
    // Using a longer slice of a UUID and removing hyphens makes it more robust.
    const generatedPassword = crypto.randomUUID().replace(/-/g, '').substring(0, 16); // 16 alphanumeric characters

    // Create a new user in Supabase's internal authentication system (auth.users table).
    // `email_confirm: true` auto-confirms the user, bypassing the email verification step.
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: generatedPassword, // Use the generated secure password
      email_confirm: true, // Automatically confirm the user's email
    });

    if (authError) {
      console.error("Supabase Auth user creation error:", authError);
      // Return the specific error message from Supabase Auth for better debugging.
      return new Response(JSON.stringify({ error: authError.message || "Failed to create authentication user" }), {
        status: 500, // Internal Server Error
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }

    // Extract the newly created user's ID from the authentication response.
    // This ID is crucial as it links the auth user to your 'users' profile table.
    const userId = authUser.user.id;

    // Insert the reseller's detailed information into your custom 'users' table.
    // This table holds additional profile data beyond what Supabase Auth stores.
    const { error: insertError } = await supabase.from("users").insert([
      {
        id: userId, // Link to the auth.users table
        email,
        name,
        region,
        role: "reseller", // Assign a specific role
        is_active: true, // Set initial status
        contact_info: { phone }, // Store phone as a JSON object (assuming jsonb column)
        flagged_status: false,
        exclusive_features: "", // Example empty string for features
      },
    ]);

    if (insertError) {
      console.error("Database insert error into 'users' table:", insertError);

      // --- CRITICAL ERROR HANDLING: Rollback Auth User if DB Insert Fails ---
      // If the profile insertion fails, we should ideally delete the user from Supabase Auth
      // to prevent orphaned authentication records. This requires an additional step.
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);
      if (deleteAuthError) {
        console.error("Failed to delete auth user after 'users' table insert failure:", deleteAuthError);
        // Log this, but the primary error returned is still the insertError.
      }
      // --- End Rollback ---

      return new Response(JSON.stringify({ error: insertError.message || "Failed to add reseller to database" }), {
        status: 500, // Internal Server Error
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }

    // If both Auth user creation and 'users' table insertion are successful,
    // return a success response.
    return new Response(JSON.stringify({ success: true, message: "Reseller added successfully!" }), {
      status: 200, // OK
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });

  } catch (err) {
    // Catch any unexpected errors that occur during the function execution.
    console.error("Unexpected Error:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error", detail: err.message }), {
      status: 500, // Internal Server Error
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });
  }
});