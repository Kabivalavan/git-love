import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Recipient {
  phone: string;
  name: string | null;
}

interface Body {
  recipients: Recipient[];
  message: string;
  media_url?: string | null;
  media_type?: "image" | "video" | "document" | null;
  media_filename?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SRK);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin", "staff"]).maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { recipients, message, media_url, media_type }: Body = await req.json();

    if (!recipients?.length || !message?.trim()) {
      return new Response(JSON.stringify({ error: "recipients and message required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load WhatsApp credentials
    const { data: waRow } = await admin.from("store_settings").select("value").eq("key", "whatsapp").maybeSingle();
    const wa = (waRow?.value as any) || {};
    if (!wa.api_url || !wa.api_token || !wa.phone_number_id) {
      return new Response(JSON.stringify({ error: "WhatsApp Business API not configured. Connect in Settings → WhatsApp." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sendUrl = `${wa.api_url.replace(/\/$/, "")}/${wa.phone_number_id}/messages`;
    const results: Array<{ phone: string; name: string | null; status: "sent" | "failed"; error?: string; id?: string }> = [];

    for (const r of recipients) {
      const phoneDigits = (r.phone || "").replace(/\D/g, "");
      if (!phoneDigits) {
        results.push({ phone: r.phone, name: r.name, status: "failed", error: "Invalid phone" });
        continue;
      }
      const intl = phoneDigits.startsWith("91") ? phoneDigits : `91${phoneDigits}`;
      const personalized = message.replace(/\{\{name\}\}/g, r.name || "there").replace(/\{\{phone\}\}/g, r.phone || "");

      let payload: any;
      if (media_url && media_type) {
        payload = {
          messaging_product: "whatsapp",
          to: intl,
          type: media_type,
          [media_type]: {
            link: media_url,
            ...(media_type !== "document" ? { caption: personalized } : { caption: personalized, filename: "file" }),
          },
        };
      } else {
        payload = {
          messaging_product: "whatsapp",
          to: intl,
          type: "text",
          text: { body: personalized },
        };
      }

      try {
        const resp = await fetch(sendUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${wa.api_token}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await resp.json();
        if (resp.ok && !data.error) {
          results.push({ phone: r.phone, name: r.name, status: "sent", id: data.messages?.[0]?.id });
        } else {
          results.push({ phone: r.phone, name: r.name, status: "failed", error: data.error?.message || `HTTP ${resp.status}` });
        }
      } catch (e: any) {
        results.push({ phone: r.phone, name: r.name, status: "failed", error: e.message });
      }

      // Small throttle to avoid rate limit
      await new Promise((res) => setTimeout(res, 250));
    }

    const sent = results.filter((r) => r.status === "sent").length;
    const failed = results.length - sent;

    await admin.from("activity_logs").insert({
      user_id: user.id,
      action: "export",
      entity_type: "settings",
      details: { name: "Bulk WhatsApp Send", total: results.length, sent, failed, has_media: !!media_url },
    });

    return new Response(JSON.stringify({ success: true, sent, failed, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[whatsapp-bulk-send]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
