import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TriggerRequest {
  trigger: string;
  data: Record<string, any>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if email automation is enabled
    const { data: emailSettings } = await supabaseAdmin
      .from("store_settings")
      .select("value")
      .eq("key", "email_automation")
      .single();

    const automation = (emailSettings?.value as any) || {};

    const body: TriggerRequest = await req.json();
    const { trigger, data } = body;

    // Get store info for templates
    const { data: storeData } = await supabaseAdmin
      .from("store_settings")
      .select("value")
      .eq("key", "store_info")
      .single();
    const storeInfo = (storeData?.value as any) || {};
    const storeName = storeInfo.name || "Our Store";

    // Determine template and variables based on trigger
    let templateId: string | null = null;
    let toEmail: string | null = null;
    let variables: Record<string, string> = { store_name: storeName };

    switch (trigger) {
      case "user_signup": {
        if (automation.welcome !== false) {
          templateId = "welcome";
          toEmail = data.email;
          variables = {
            ...variables,
            customer_name: data.full_name || "there",
            discount: data.discount || "10",
            coupon_code: data.coupon_code || "WELCOME10",
            shop_url: data.shop_url || SUPABASE_URL.replace(".supabase.co", ".lovable.app"),
          };
        }
        break;
      }
      case "cart_abandonment": {
        if (automation.cart_abandonment !== false) {
          templateId = "cart_abandonment";
          toEmail = data.email;
          variables = {
            ...variables,
            customer_name: data.customer_name || "there",
            cart_items: data.cart_items || "",
            cart_total: data.cart_total || "0",
            checkout_url: data.checkout_url || "",
          };
        }
        break;
      }
      case "order_created": {
        if (automation.order_confirmation !== false) {
          templateId = "order_confirmation";
          toEmail = data.email;
          variables = {
            ...variables,
            customer_name: data.customer_name || "there",
            order_number: data.order_number || "",
            order_items: data.order_items || "",
            order_total: data.order_total || "0",
            delivery_address: data.delivery_address || "",
            tracking_url: data.tracking_url || "",
          };
        }
        break;
      }
      case "payment_success": {
        if (automation.payment_confirmation !== false) {
          templateId = "payment_confirmation";
          toEmail = data.email;
          variables = {
            ...variables,
            customer_name: data.customer_name || "there",
            order_number: data.order_number || "",
            amount: data.amount || "0",
            payment_method: data.payment_method || "Online",
            transaction_id: data.transaction_id || "N/A",
          };
        }
        break;
      }
      case "order_shipped": {
        if (automation.order_shipped !== false) {
          templateId = "order_shipped";
          toEmail = data.email;
          variables = {
            ...variables,
            customer_name: data.customer_name || "there",
            order_number: data.order_number || "",
            courier_name: data.courier_name || "Our Delivery Partner",
            tracking_number: data.tracking_number || "N/A",
            estimated_delivery: data.estimated_delivery || "2-5 days",
            tracking_url: data.tracking_url || "",
            shop_url: data.shop_url || "",
          };
        }
        break;
      }
      case "out_for_delivery": {
        if (automation.out_for_delivery !== false) {
          templateId = "out_for_delivery";
          toEmail = data.email;
          variables = {
            ...variables,
            customer_name: data.customer_name || "there",
            order_number: data.order_number || "",
            cod_amount: data.cod_amount || "0",
          };
        }
        break;
      }
      case "order_delivered": {
        if (automation.order_delivered !== false) {
          templateId = "order_delivered";
          toEmail = data.email;
          variables = {
            ...variables,
            customer_name: data.customer_name || "there",
            order_number: data.order_number || "",
            review_url: data.review_url || "",
            next_order_coupon: data.next_order_coupon || "COMEBACK10",
          };
        }
        break;
      }
      case "review_request": {
        if (automation.review_request !== false) {
          templateId = "review_request";
          toEmail = data.email;
          variables = {
            ...variables,
            customer_name: data.customer_name || "there",
            product_name: data.product_name || "your purchase",
            review_url: data.review_url || "",
            discount: data.discount || "10",
            coupon_code: data.coupon_code || "REVIEW10",
          };
        }
        break;
      }
      default:
        return new Response(
          JSON.stringify({ error: `Unknown trigger: ${trigger}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    if (!templateId || !toEmail) {
      return new Response(
        JSON.stringify({ success: true, message: "Email trigger skipped (disabled or missing data)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call the send-smtp-email function
    const sendResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-smtp-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        to: toEmail,
        template_id: templateId,
        variables,
      }),
    });

    const sendResult = await sendResponse.json();

    if (!sendResponse.ok) {
      console.error("Email send failed:", sendResult);
      return new Response(
        JSON.stringify({ success: false, error: sendResult.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: `Email sent for trigger: ${trigger}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Trigger Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
