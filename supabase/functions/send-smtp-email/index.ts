import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SmtpConfig {
  host: string;
  port: number;
  encryption: "STARTTLS" | "SSL/TLS" | "None";
  username: string;
  password: string;
  from_name: string;
  from_email: string;
}

interface EmailRequest {
  to: string;
  subject?: string;
  html?: string;
  template_id?: string;
  variables?: Record<string, string>;
}

/* ─── Brand wrapper that wraps any email body ──────────────── */
function wrapInBrandLayout(bodyHtml: string, storeName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body,html{margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
  .email-wrapper{width:100%;background:#f4f4f7;padding:32px 0}
  .email-card{max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)}
  .email-header{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:28px 32px;text-align:center}
  .email-header h1{color:#ffffff;font-size:20px;margin:0;font-weight:700;letter-spacing:0.3px}
  .email-body{padding:32px 32px 24px}
  .email-body p{color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px}
  .email-body h2{color:#111827;font-size:18px;font-weight:700;margin:0 0 12px}
  .info-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:20px 0}
  .info-row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9}
  .info-row:last-child{border-bottom:none}
  .info-row strong{color:#1e293b}
  .coupon-box{background:linear-gradient(135deg,#fef3c7,#fde68a);border:2px dashed #f59e0b;border-radius:10px;padding:20px;text-align:center;margin:20px 0}
  .coupon-code{font-size:26px;font-weight:800;color:#92400e;letter-spacing:4px;margin:4px 0}
  .btn-primary{display:inline-block;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#ffffff!important;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;text-align:center;box-shadow:0 4px 12px rgba(37,99,235,0.3)}
  .btn-success{display:inline-block;background:linear-gradient(135deg,#22c55e,#16a34a);color:#ffffff!important;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;text-align:center;box-shadow:0 4px 12px rgba(22,163,74,0.3)}
  .email-footer{background:#f8fafc;padding:24px 32px;text-align:center;border-top:1px solid #e2e8f0}
  .email-footer p{color:#94a3b8;font-size:12px;margin:0;line-height:1.6}
  .highlight{color:#2563eb;font-weight:600}
  .warning-box{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px 20px;margin:20px 0}
  .warning-box p{color:#9a3412;font-size:14px;margin:0}
</style>
</head>
<body>
<div class="email-wrapper">
  <div class="email-card">
    <div class="email-header"><h1>${storeName}</h1></div>
    <div class="email-body">${bodyHtml}</div>
    <div class="email-footer">
      <p>${storeName}<br>You received this email because of your activity with us.</p>
    </div>
  </div>
</div>
</body>
</html>`;
}

// Modern email templates
const DEFAULT_TEMPLATES: Record<string, { subject: string; html: string }> = {
  welcome: {
    subject: "Welcome to {{store_name}} 🎉 Enjoy {{discount}}% off!",
    html: `<h2>Welcome aboard! 🎉</h2>
<p>Hi <strong>{{customer_name}}</strong>,</p>
<p>We're thrilled to have you join the {{store_name}} family. To kick things off, here's a special welcome gift just for you.</p>
<div class="coupon-box">
  <p style="color:#92400e;font-size:13px;margin:0 0 4px">YOUR WELCOME CODE</p>
  <p class="coupon-code">{{coupon_code}}</p>
  <p style="color:#b45309;font-size:14px;margin:4px 0 0">Get <strong>{{discount}}% OFF</strong> your first order</p>
</div>
<div style="text-align:center;margin:24px 0">
  <a href="{{shop_url}}" class="btn-primary">Start Shopping →</a>
</div>
<div class="info-box">
  <p style="color:#475569;font-size:14px;margin:0"><strong>Why shop with us?</strong></p>
  <p style="color:#64748b;font-size:13px;margin:8px 0 0">✓ Fast & reliable delivery &nbsp;&nbsp; ✓ Easy returns &nbsp;&nbsp; ✓ Secure payments</p>
</div>`,
  },
  browse_abandonment: {
    subject: "Still thinking about {{product_name}}? 👀",
    html: `<h2>Still on your mind? 👀</h2>
<p>Hi <strong>{{customer_name}}</strong>,</p>
<p>We noticed you were checking out <span class="highlight">{{product_name}}</span>. It's still waiting for you!</p>
<div style="text-align:center;margin:24px 0">
  <a href="{{product_url}}" class="btn-primary">View It Again →</a>
</div>`,
  },
  cart_abandonment: {
    subject: "Your cart is waiting 🛒 Don't miss out!",
    html: `<h2>You left something behind 🛒</h2>
<p>Hi <strong>{{customer_name}}</strong>,</p>
<p>Your cart is packed and ready — you're just one step away from completing your order!</p>
<div class="info-box">
  <p style="color:#1e293b;font-weight:700;font-size:14px;margin:0 0 10px">🛍️ Your Cart</p>
  <p style="color:#475569;font-size:14px;margin:0">{{cart_items}}</p>
  <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0">
    <p style="color:#1e293b;font-weight:700;font-size:16px;margin:0">Total: ₹{{cart_total}}</p>
  </div>
</div>
<div style="text-align:center;margin:24px 0">
  <a href="{{checkout_url}}" class="btn-primary">Complete Your Purchase →</a>
</div>
<p style="color:#ef4444;font-size:13px;text-align:center">⏰ Items may sell out soon — don't wait too long!</p>`,
  },
  order_confirmation: {
    subject: "Order Confirmed ✅ #{{order_number}}",
    html: `<h2>Order Confirmed! ✅</h2>
<p>Hi <strong>{{customer_name}}</strong>,</p>
<p>Thank you for your order! We've received <strong>Order #{{order_number}}</strong> and are getting it ready for you.</p>
<div class="info-box">
  <p style="color:#1e293b;font-weight:700;font-size:14px;margin:0 0 12px">📦 Order Summary</p>
  <div class="info-row"><span>Items</span><strong>{{order_items}}</strong></div>
  <div class="info-row"><span>Total</span><strong>₹{{order_total}}</strong></div>
  <div class="info-row"><span>Delivery To</span><strong>{{delivery_address}}</strong></div>
</div>
<div style="text-align:center;margin:24px 0">
  <a href="{{tracking_url}}" class="btn-primary">Track Your Order →</a>
</div>`,
  },
  payment_confirmation: {
    subject: "Payment Received 💳 Order #{{order_number}}",
    html: `<h2>Payment Received! 💳</h2>
<p>Hi <strong>{{customer_name}}</strong>,</p>
<p>We've successfully received your payment. Here are the details:</p>
<div class="info-box">
  <div class="info-row"><span>Order</span><strong>#{{order_number}}</strong></div>
  <div class="info-row"><span>Amount</span><strong>₹{{amount}}</strong></div>
  <div class="info-row"><span>Method</span><strong>{{payment_method}}</strong></div>
  <div class="info-row"><span>Transaction ID</span><strong>{{transaction_id}}</strong></div>
</div>`,
  },
  order_shipped: {
    subject: "Your order is on the way! 🚚 #{{order_number}}",
    html: `<h2>Your order is on the way! 🚚</h2>
<p>Hi <strong>{{customer_name}}</strong>,</p>
<p>Great news! Your order <strong>#{{order_number}}</strong> has been shipped and is heading your way.</p>
<div class="info-box">
  <p style="color:#1e293b;font-weight:700;font-size:14px;margin:0 0 12px">📦 Shipment Details</p>
  <div class="info-row"><span>Courier</span><strong>{{courier_name}}</strong></div>
  <div class="info-row"><span>Tracking #</span><strong>{{tracking_number}}</strong></div>
  <div class="info-row"><span>ETA</span><strong>{{estimated_delivery}}</strong></div>
</div>
<div style="text-align:center;margin:24px 0">
  <a href="{{tracking_url}}" class="btn-primary">Track Shipment →</a>
</div>`,
  },
  out_for_delivery: {
    subject: "Out for delivery today! 📦 #{{order_number}}",
    html: `<h2>Out for delivery today! 📦</h2>
<p>Hi <strong>{{customer_name}}</strong>,</p>
<p>Your order <strong>#{{order_number}}</strong> is out for delivery and will reach you today!</p>
<div class="warning-box">
  <p><strong>📍 Please note:</strong></p>
  <p style="margin-top:6px!important">COD Amount (if applicable): <strong>₹{{cod_amount}}</strong><br>Please keep your phone accessible for the delivery agent.</p>
</div>`,
  },
  order_delivered: {
    subject: "Delivered! 🎉 We hope you love it!",
    html: `<h2>Your order has been delivered! 🎉</h2>
<p>Hi <strong>{{customer_name}}</strong>,</p>
<p>Your order <strong>#{{order_number}}</strong> has been successfully delivered. We hope you love your purchase!</p>
<div style="text-align:center;margin:24px 0">
  <a href="{{review_url}}" class="btn-success">⭐ Share Your Experience</a>
</div>
<div class="coupon-box">
  <p style="color:#92400e;font-size:13px;margin:0 0 4px">🎁 THANK YOU REWARD</p>
  <p class="coupon-code">{{next_order_coupon}}</p>
  <p style="color:#b45309;font-size:14px;margin:4px 0 0">Use this on your next order!</p>
</div>`,
  },
  review_request: {
    subject: "How was {{product_name}}? ⭐ Share your thoughts",
    html: `<h2>We'd love your feedback! ⭐</h2>
<p>Hi <strong>{{customer_name}}</strong>,</p>
<p>How are you enjoying <span class="highlight">{{product_name}}</span>? Your review helps other shoppers make great choices.</p>
<div style="text-align:center;margin:24px 0">
  <a href="{{review_url}}" class="btn-primary">Leave a Review →</a>
</div>
<div class="coupon-box">
  <p style="color:#92400e;font-size:13px;margin:0 0 4px">YOUR REVIEW REWARD</p>
  <p class="coupon-code">{{coupon_code}}</p>
  <p style="color:#b45309;font-size:14px;margin:4px 0 0">Get <strong>{{discount}}% OFF</strong> your next order!</p>
</div>`,
  },
};

function renderTemplate(
  templateId: string,
  variables: Record<string, string>,
  customTemplates: Record<string, { subject: string; html: string }> | null
): { subject: string; html: string } {
  const template = customTemplates?.[templateId] || DEFAULT_TEMPLATES[templateId];
  if (!template) throw new Error(`Template '${templateId}' not found`);

  let subject = template.subject;
  let html = template.html;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    subject = subject.replace(regex, value);
    html = html.replace(regex, value);
  }

  // Clean up any remaining placeholders
  html = html.replace(/\{\{header_image\}\}/g, "");

  // Wrap in brand layout
  const storeName = variables.store_name || "Our Store";
  html = wrapInBrandLayout(html, storeName);

  return { subject, html };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch SMTP config
    const { data: smtpData, error: smtpError } = await supabaseAdmin
      .from("store_settings")
      .select("value")
      .eq("key", "smtp_config")
      .single();

    if (smtpError || !smtpData) {
      console.error("[send-smtp-email] SMTP not configured:", smtpError?.message);
      return new Response(
        JSON.stringify({ error: "SMTP not configured. Go to Settings → Email to set up SMTP." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const smtpConfig = smtpData.value as unknown as SmtpConfig;
    if (!smtpConfig.host || !smtpConfig.username || !smtpConfig.password) {
      return new Response(
        JSON.stringify({ error: "SMTP configuration incomplete." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: EmailRequest = await req.json();
    let { to, subject, html } = body;

    // If template_id is provided, render from template
    if (body.template_id && body.variables) {
      let customTemplates: Record<string, { subject: string; html: string }> | null = null;
      const { data: tplData } = await supabaseAdmin
        .from("store_settings")
        .select("value")
        .eq("key", "email_templates")
        .single();
      if (tplData?.value) {
        customTemplates = tplData.value as unknown as Record<string, { subject: string; html: string }>;
      }

      const rendered = renderTemplate(body.template_id, body.variables, customTemplates);
      subject = rendered.subject;
      html = rendered.html;
    }

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html (or template_id + variables)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Configure nodemailer transport
    const isSSL = smtpConfig.encryption === "SSL/TLS";
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: isSSL,
      auth: {
        user: smtpConfig.username,
        pass: smtpConfig.password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const fromAddress = `${smtpConfig.from_name || "Store"} <${smtpConfig.from_email || smtpConfig.username}>`;

    console.log(`[send-smtp-email] Sending to=${to}, subject=${subject?.substring(0, 50)}`);

    await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
    });

    console.log(`[send-smtp-email] Email sent successfully to ${to}`);

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-smtp-email] SMTP Error:", error.message, error.stack);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
