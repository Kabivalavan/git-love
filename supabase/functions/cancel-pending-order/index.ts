import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { order_id, reason } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SRK);

    // Verify ownership
    const { data: ord } = await admin
      .from("orders")
      .select("id, user_id, status, payment_status")
      .eq("id", order_id)
      .maybeSingle();

    if (!ord || ord.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only cancel new/pending orders (avoid blowing away paid/shipped)
    if (ord.status !== "new" || ord.payment_status === "paid") {
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch order details for email before mutating
    const { data: ordFull } = await admin
      .from("orders")
      .select("order_number, total, customer_email, customer_name")
      .eq("id", order_id)
      .maybeSingle();

    await admin
      .from("orders")
      .update({ status: "cancelled", payment_status: "failed" })
      .eq("id", order_id);

    await admin
      .from("payments")
      .update({ status: "failed" })
      .eq("order_id", order_id);

    // Release any stock holds tied to this order or user-active
    await admin.rpc("release_stock_hold", {
      p_user_id: user.id,
      p_order_id: order_id,
    });

    await admin.from("activity_logs").insert({
      user_id: user.id,
      action: "status_change",
      entity_type: "order",
      entity_id: order_id,
      details: { from: "new", to: "cancelled", reason: reason || "payment_cancelled" },
    });

    // Fire order_cancelled email (best-effort, non-blocking failure)
    if (ordFull?.customer_email) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/email-triggers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SRK}`,
          },
          body: JSON.stringify({
            trigger: "order_cancelled",
            data: {
              email: ordFull.customer_email,
              customer_name: ordFull.customer_name,
              order_number: ordFull.order_number,
              order_total: Number(ordFull.total || 0).toFixed(0),
              reason: reason || "payment cancelled",
            },
          }),
        });
      } catch (e) {
        console.error("[cancel-pending-order] email trigger failed", e);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[cancel-pending-order]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
