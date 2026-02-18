import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  order_id: string; // Our internal order ID
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Fallback: read from store_settings if env var not set
    if (!RAZORPAY_KEY_SECRET) {
      const supabaseTemp = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: creds } = await supabaseTemp
        .from("store_settings")
        .select("value")
        .eq("key", "razorpay_credentials")
        .single();
      
      if (creds?.value) {
        const val = creds.value as Record<string, string>;
        RAZORPAY_KEY_SECRET = val.key_secret;
      }
    }

    if (!RAZORPAY_KEY_SECRET) {
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

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabaseUser.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: VerifyPaymentRequest = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !order_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify signature
    const generatedSignature = await generateSignature(
      `${razorpay_order_id}|${razorpay_payment_id}`,
      RAZORPAY_KEY_SECRET
    );

    if (generatedSignature !== razorpay_signature) {
      return new Response(JSON.stringify({ error: "Invalid payment signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to update order and payment
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the order belongs to the user
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, total")
      .eq("id", order_id)
      .single();

    if (orderError || !orderData) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (orderData.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update order payment status
    await supabaseAdmin
      .from("orders")
      .update({ payment_status: "paid" })
      .eq("id", order_id);

    // Create payment record
    await supabaseAdmin.from("payments").insert({
      order_id: order_id,
      amount: orderData.total,
      method: "online",
      status: "paid",
      transaction_id: razorpay_payment_id,
      gateway_response: {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment verified successfully",
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

async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const data = encoder.encode(payload);
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", key, data);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
