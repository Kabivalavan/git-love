import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Verify auth - must be admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (req.method === "GET" && action === "status") {
      // Check if Razorpay secrets are configured
      const keyId = Deno.env.get("RAZORPAY_KEY_ID");
      const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

      return new Response(
        JSON.stringify({
          connected: !!(keyId && keySecret),
          has_key_id: !!keyId,
          has_key_secret: !!keySecret,
          key_id_preview: keyId ? `${keyId.substring(0, 8)}...${keyId.substring(keyId.length - 4)}` : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST" && action === "connect") {
      const body = await req.json();
      const { key_id, key_secret } = body;

      if (!key_id || !key_secret) {
        return new Response(JSON.stringify({ error: "Both API Key ID and Secret are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate keys by making a test API call to Razorpay
      const auth = btoa(`${key_id}:${key_secret}`);
      const testResponse = await fetch("https://api.razorpay.com/v1/payments?count=1", {
        headers: { Authorization: `Basic ${auth}` },
      });

      if (!testResponse.ok) {
        const errText = await testResponse.text();
        console.error("Razorpay validation failed:", errText);
        return new Response(
          JSON.stringify({ error: "Invalid Razorpay credentials. Please verify your API Key ID and Secret." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Store credentials in store_settings (masked) for reference
      await supabaseAdmin
        .from("store_settings")
        .upsert(
          {
            key: "razorpay",
            value: {
              key_id_preview: `${key_id.substring(0, 8)}...${key_id.substring(key_id.length - 4)}`,
              is_connected: true,
              connected_at: new Date().toISOString(),
              is_test_mode: key_id.startsWith("rzp_test_"),
            },
          },
          { onConflict: "key" }
        );

      // Store the actual keys as Deno env vars won't persist across deploys.
      // We store them in store_settings as encrypted-like storage.
      // The edge functions will read from store_settings if env vars aren't set.
      await supabaseAdmin
        .from("store_settings")
        .upsert(
          {
            key: "razorpay_credentials",
            value: { key_id, key_secret },
          },
          { onConflict: "key" }
        );

      return new Response(
        JSON.stringify({
          success: true,
          message: "Razorpay connected successfully",
          is_test_mode: key_id.startsWith("rzp_test_"),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST" && action === "disconnect") {
      await supabaseAdmin
        .from("store_settings")
        .upsert(
          {
            key: "razorpay",
            value: { is_connected: false, key_id_preview: null },
          },
          { onConflict: "key" }
        );

      await supabaseAdmin
        .from("store_settings")
        .delete()
        .eq("key", "razorpay_credentials");

      return new Response(
        JSON.stringify({ success: true, message: "Razorpay disconnected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
