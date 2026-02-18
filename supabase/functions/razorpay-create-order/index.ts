import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CreateOrderRequest {
  amount: number; // Amount in INR (will be converted to paise)
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    let RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

    // Fallback: read from store_settings if env vars not set
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      const { data: creds } = await supabaseAdmin
        .from("store_settings")
        .select("value")
        .eq("key", "razorpay_credentials")
        .single();
      
      if (creds?.value) {
        const val = creds.value as Record<string, string>;
        RAZORPAY_KEY_ID = val.key_id;
        RAZORPAY_KEY_SECRET = val.key_secret;
      }
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay credentials not configured. Please connect Razorpay in Admin Settings.");
    }

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: CreateOrderRequest = await req.json();
    const { amount, currency = "INR", receipt, notes } = body;

    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Razorpay expects amount in paise (smallest currency unit)
    const amountInPaise = Math.round(amount * 100);

    // Create Razorpay order
    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency,
        receipt: receipt || `rcpt_${Date.now()}`,
        notes: notes || {},
      }),
    });

    if (!razorpayResponse.ok) {
      const errorData = await razorpayResponse.text();
      console.error("Razorpay error:", errorData);
      throw new Error("Failed to create Razorpay order");
    }

    const razorpayOrder = await razorpayResponse.json();

    return new Response(
      JSON.stringify({
        order_id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        key_id: RAZORPAY_KEY_ID,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
