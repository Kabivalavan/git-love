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

// Default email templates (fallback if no custom template in DB)
const DEFAULT_TEMPLATES: Record<string, { subject: string; html: string }> = {
  welcome: {
    subject: "Welcome to {{store_name}} \u{1F389} Enjoy {{discount}}% off your first order",
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#fff;">
      <h1 style="color:#333;font-size:24px;">Welcome to {{store_name}}! \u{1F389}</h1>
      <p style="color:#555;font-size:16px;line-height:1.6;">Hi {{customer_name}} \u{1F44B}</p>
      <p style="color:#555;font-size:16px;line-height:1.6;">Welcome to {{store_name}} — we're excited to have you!</p>
      <p style="color:#555;font-size:16px;line-height:1.6;">As a welcome gift, here's <strong>{{discount}}% OFF</strong> your first order \u{1F381}</p>
      <div style="background:#f8f9fa;border:2px dashed #007bff;border-radius:8px;padding:20px;text-align:center;margin:20px 0;">
        <p style="color:#666;font-size:14px;margin:0 0 5px;">Your Welcome Code</p>
        <p style="color:#007bff;font-size:28px;font-weight:bold;margin:0;letter-spacing:3px;">{{coupon_code}}</p>
      </div>
      <a href="{{shop_url}}" style="display:inline-block;background:#007bff;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Start Shopping Now \u{1F449}</a>
      <div style="margin-top:30px;padding-top:20px;border-top:1px solid #eee;">
        <p style="color:#555;font-size:14px;">\u2728 Why customers love us:</p>
        <ul style="color:#555;font-size:14px;line-height:1.8;"><li>Fast & reliable delivery</li><li>Easy returns</li><li>Secure payments</li></ul>
      </div>
      <p style="color:#555;font-size:14px;margin-top:20px;">Happy shopping,<br/>Team {{store_name}}</p>
    </div>`,
  },
  browse_abandonment: {
    subject: "Still interested in {{product_name}}? \u{1F440}",
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#fff;">
      <h1 style="color:#333;font-size:24px;">Still interested? \u{1F440}</h1>
      <p style="color:#555;font-size:16px;line-height:1.6;">Hi {{customer_name}},</p>
      <p style="color:#555;font-size:16px;line-height:1.6;">You were checking out <strong>{{product_name}}</strong>, and we thought you might want another look \u{1F447}</p>
      <a href="{{product_url}}" style="display:inline-block;background:#007bff;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">View it again</a>
      <p style="color:#555;font-size:14px;margin-top:20px;">— {{store_name}}</p>
    </div>`,
  },
  cart_abandonment: {
    subject: "Your cart is waiting \u{1F6D2} Complete your order",
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#fff;">
      <h1 style="color:#333;font-size:24px;">Your cart is waiting \u{1F6D2}</h1>
      <p style="color:#555;font-size:16px;line-height:1.6;">Hi {{customer_name}},</p>
      <p style="color:#555;font-size:16px;line-height:1.6;">You're just one step away from completing your order \u{1F3AF}</p>
      <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="color:#333;font-weight:bold;margin:0 0 10px;">\u{1F6CD}\uFE0F Items in your cart:</p>
        <p style="color:#555;font-size:14px;margin:0;">{{cart_items}}</p>
        <p style="color:#333;font-weight:bold;font-size:18px;margin:10px 0 0;">\u{1F4B0} Total: \u20B9{{cart_total}}</p>
      </div>
      <a href="{{checkout_url}}" style="display:inline-block;background:#007bff;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Complete your purchase \u{1F449}</a>
      <p style="color:#e74c3c;font-size:14px;margin-top:15px;">\u23F0 Items may sell out soon.</p>
      <p style="color:#555;font-size:14px;">— {{store_name}}</p>
    </div>`,
  },
  order_confirmation: {
    subject: "Order confirmed \u2705 #{{order_number}}",
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#fff;">
      <h1 style="color:#333;font-size:24px;">Order Confirmed \u2705</h1>
      <p style="color:#555;font-size:16px;line-height:1.6;">Hi {{customer_name}},</p>
      <p style="color:#555;font-size:16px;line-height:1.6;">Thank you for your order! \u{1F389}<br/>We've received Order <strong>#{{order_number}}</strong>.</p>
      <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="color:#333;font-weight:bold;margin:0 0 10px;">\u{1F4E6} Order Summary</p>
        <p style="color:#555;font-size:14px;margin:5px 0;">Items: {{order_items}}</p>
        <p style="color:#555;font-size:14px;margin:5px 0;">Total: <strong>\u20B9{{order_total}}</strong></p>
        <p style="color:#555;font-size:14px;margin:5px 0;">Address: {{delivery_address}}</p>
      </div>
      {{header_image}}
      <a href="{{tracking_url}}" style="display:inline-block;background:#007bff;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Track your order \u{1F449}</a>
      <p style="color:#555;font-size:14px;margin-top:20px;">— {{store_name}}</p>
    </div>`,
  },
  payment_confirmation: {
    subject: "Payment received \u{1F4B3} for Order #{{order_number}}",
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#fff;">
      <h1 style="color:#333;font-size:24px;">Payment Received \u{1F4B3}</h1>
      <p style="color:#555;font-size:16px;line-height:1.6;">Hi {{customer_name}},</p>
      <p style="color:#555;font-size:16px;line-height:1.6;">We've received your payment successfully \u2705</p>
      <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="color:#333;font-weight:bold;margin:0 0 10px;">\u{1F4B3} Payment Details</p>
        <p style="color:#555;font-size:14px;margin:5px 0;">Order: {{order_number}}</p>
        <p style="color:#555;font-size:14px;margin:5px 0;">Amount: <strong>\u20B9{{amount}}</strong></p>
        <p style="color:#555;font-size:14px;margin:5px 0;">Method: {{payment_method}}</p>
        <p style="color:#555;font-size:14px;margin:5px 0;">Transaction: {{transaction_id}}</p>
      </div>
      {{header_image}}
      <p style="color:#555;font-size:14px;">— {{store_name}}</p>
    </div>`,
  },
  order_shipped: {
    subject: "Your order is on the way \u{1F69A}",
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#fff;">
      <h1 style="color:#333;font-size:24px;">Your order is on the way! \u{1F69A}</h1>
      <p style="color:#555;font-size:16px;line-height:1.6;">Hi {{customer_name}},</p>
      <p style="color:#555;font-size:16px;line-height:1.6;">Your order <strong>#{{order_number}}</strong> has been shipped \u{1F389}</p>
      <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="color:#333;font-weight:bold;margin:0 0 10px;">\u{1F69A} Shipment Details</p>
        <p style="color:#555;font-size:14px;margin:5px 0;">Courier: {{courier_name}}</p>
        <p style="color:#555;font-size:14px;margin:5px 0;">Tracking: {{tracking_number}}</p>
        <p style="color:#555;font-size:14px;margin:5px 0;">ETA: {{estimated_delivery}}</p>
      </div>
      {{header_image}}
      <a href="{{tracking_url}}" style="display:inline-block;background:#007bff;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Track shipment \u{1F449}</a>
      <p style="color:#555;font-size:14px;margin-top:20px;">— {{store_name}}</p>
    </div>`,
  },
  out_for_delivery: {
    subject: "Out for delivery today \u{1F4E6}",
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#fff;">
      <h1 style="color:#333;font-size:24px;">Out for delivery today! \u{1F4E6}</h1>
      <p style="color:#555;font-size:16px;line-height:1.6;">Hi {{customer_name}},</p>
      <p style="color:#555;font-size:16px;line-height:1.6;">Your order <strong>#{{order_number}}</strong> is out for delivery \u{1F69A}</p>
      <div style="background:#fff3cd;border-radius:8px;padding:16px;margin:20px 0;">
        <p style="color:#856404;font-weight:bold;margin:0 0 5px;">\u{1F4CD} Important</p>
        <p style="color:#856404;font-size:14px;margin:5px 0;">COD Amount (if any): \u20B9{{cod_amount}}</p>
        <p style="color:#856404;font-size:14px;margin:5px 0;">Please keep your phone available.</p>
      </div>
      {{header_image}}
      <p style="color:#555;font-size:14px;">Thank you \u{1F64C}<br/>— {{store_name}}</p>
    </div>`,
  },
  order_delivered: {
    subject: "Delivered \u{1F389} We hope you love it!",
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#fff;">
      <h1 style="color:#333;font-size:24px;">Delivered! \u{1F389}</h1>
      <p style="color:#555;font-size:16px;line-height:1.6;">Hi {{customer_name}},</p>
      <p style="color:#555;font-size:16px;line-height:1.6;">Your order <strong>#{{order_number}}</strong> has been delivered \u{1F389}</p>
      <div style="text-align:center;margin:20px 0;">
        <a href="{{review_url}}" style="display:inline-block;background:#28a745;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">\u2B50 Share your experience</a>
      </div>
      <div style="background:#f8f9fa;border:2px dashed #28a745;border-radius:8px;padding:16px;text-align:center;margin:20px 0;">
        <p style="color:#555;font-size:14px;margin:0 0 5px;">\u{1F381} Special offer for your next order:</p>
        <p style="color:#28a745;font-size:20px;font-weight:bold;margin:0;">{{next_order_coupon}}</p>
      </div>
      {{header_image}}
      <p style="color:#555;font-size:14px;">— {{store_name}}</p>
    </div>`,
  },
  review_request: {
    subject: "How was your experience with {{product_name}}? \u2B50",
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#fff;">
      <h1 style="color:#333;font-size:24px;">How was your experience? \u2B50</h1>
      <p style="color:#555;font-size:16px;line-height:1.6;">Hi {{customer_name}},</p>
      <p style="color:#555;font-size:16px;line-height:1.6;">We'd love to hear your thoughts on <strong>{{product_name}}</strong> \u{1F4AC}</p>
      <a href="{{review_url}}" style="display:inline-block;background:#007bff;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Leave a review \u{1F449}</a>
      <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:20px 0;text-align:center;">
        <p style="color:#555;font-size:14px;margin:0 0 5px;">Enjoy <strong>{{discount}}% OFF</strong> your next order \u{1F381}</p>
        <p style="color:#007bff;font-size:22px;font-weight:bold;margin:0;">{{coupon_code}}</p>
      </div>
      {{header_image}}
      <p style="color:#555;font-size:14px;">Thanks \u{1F49A}<br/>— {{store_name}}</p>
    </div>`,
  },
};

function renderTemplate(
  templateId: string,
  variables: Record<string, string>,
  customTemplates: Record<string, { subject: string; html: string }> | null
): { subject: string; html: string } {
  // Use custom template if available, otherwise default
  const template = customTemplates?.[templateId] || DEFAULT_TEMPLATES[templateId];
  if (!template) throw new Error(`Template '${templateId}' not found`);

  let subject = template.subject;
  let html = template.html;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    subject = subject.replace(regex, value);
    html = html.replace(regex, value);
  }

  // Clean up any remaining {{header_image}} placeholder if not provided
  html = html.replace(/\{\{header_image\}\}/g, "");

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
      // Fetch custom templates from DB
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
      secure: isSSL, // true for 465, false for other ports
      auth: {
        user: smtpConfig.username,
        pass: smtpConfig.password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const fromAddress = `${smtpConfig.from_name || "Store"} <${smtpConfig.from_email || smtpConfig.username}>`;

    await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
    });

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("SMTP Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
