import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is admin
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims, error: claimsErr } = await anonClient.auth.getUser();
    if (claimsErr || !claims.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", claims.user.id)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get AI assistant config
    const { data: configData } = await supabase
      .from("store_settings")
      .select("value")
      .eq("key", "ai_assistant")
      .single();

    if (!configData?.value) {
      return new Response(
        JSON.stringify({ error: "AI assistant not configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const config = configData.value as any;
    const { site_id, secret_key, api_base } = config;

    if (!site_id || !secret_key || !api_base) {
      return new Response(
        JSON.stringify({ error: "Missing Site ID, Secret Key, or API Base" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch all active products with images, categories, and variants
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select(`
        id, name, slug, description, short_description, price, mrp,
        category_id, badge, sku, barcode, stock_quantity, low_stock_threshold,
        shipping_weight, tax_rate, variant_required, is_featured, is_bestseller,
        content_sections,
        categories(name),
        product_images(image_url, is_primary, sort_order),
        product_variants(id, name, sku, price, mrp, stock_quantity, is_active, attributes, image_url, sort_order)
      `)
      .eq("is_active", true)
      .order("sort_order");

    if (prodErr) {
      throw new Error(`Failed to fetch products: ${prodErr.message}`);
    }

    // Build the store's base URL from store_info or fallback
    const { data: storeData } = await supabase
      .from("store_settings")
      .select("value")
      .eq("key", "store_info")
      .single();

    const storeUrl = (storeData?.value as any)?.store_url || "";

    const mappedProducts = (products || []).map((p: any) => {
      const primaryImage = p.product_images?.find((img: any) => img.is_primary);
      const firstImage = p.product_images?.[0];

      // Map variants
      const variants = (p.product_variants || [])
        .filter((v: any) => v.is_active)
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((v: any) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          price: v.price,
          mrp: v.mrp,
          stockQuantity: v.stock_quantity,
          attributes: v.attributes,
          imageUrl: v.image_url,
        }));

      return {
        externalId: p.id,
        name: p.name,
        slug: p.slug,
        category: p.categories?.name || null,
        description: p.short_description || p.description || "",
        shortDescription: p.short_description || "",
        price: p.price,
        currency: "INR",
        imageUrl: primaryImage?.image_url || firstImage?.image_url || null,
        productUrl: storeUrl
          ? `${storeUrl}/product/${p.slug}`
          : `/product/${p.slug}`,
        concerns: p.badge ? [p.badge] : [],
        tags: [],
        badge: p.badge,
        sku: p.sku,
        barcode: p.barcode,
        mrp: p.mrp,
        stockQuantity: p.stock_quantity,
        lowStockThreshold: p.low_stock_threshold,
        shippingWeight: p.shipping_weight,
        taxRate: p.tax_rate,
        variantRequired: p.variant_required,
        isFeatured: p.is_featured,
        isBestseller: p.is_bestseller,
        contentSections: p.content_sections,
        variants,
        attributes: { mrp: p.mrp },
      };
    });

    // Sync to external AI assistant API
    const syncRes = await fetch(`${api_base}/sync-products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-site-id": site_id,
        "x-secret-key": secret_key,
      },
      body: JSON.stringify({ products: mappedProducts }),
    });

    const syncData = await syncRes.json();
    if (!syncRes.ok) {
      throw new Error(
        `Sync API error [${syncRes.status}]: ${JSON.stringify(syncData)}`
      );
    }

    return new Response(
      JSON.stringify({ synced: syncData.synced || mappedProducts.length }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("AI assistant sync error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
