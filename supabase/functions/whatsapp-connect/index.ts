import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is admin
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { action, api_url, api_token, phone_number_id } = await req.json();

    if (action === 'test_connection') {
      // Test the WhatsApp Business API connection
      if (!api_url || !api_token) {
        return new Response(JSON.stringify({ success: false, error: 'API URL and Token are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Try to fetch the phone number info from WhatsApp Cloud API
      const testUrl = `${api_url.replace(/\/$/, '')}/${phone_number_id || 'me'}`;
      try {
        const waResp = await fetch(testUrl, {
          headers: { 'Authorization': `Bearer ${api_token}` },
        });
        const waData = await waResp.json();

        if (waResp.ok && !waData.error) {
          // Save the settings
          const settings = {
            api_url,
            api_token,
            phone_number_id: phone_number_id || '',
            connected: true,
            connected_at: new Date().toISOString(),
            display_name: waData.verified_name || waData.display_phone_number || 'Connected',
          };

          const { data: existing } = await supabase
            .from('store_settings')
            .select('id')
            .eq('key', 'whatsapp')
            .single();

          if (existing) {
            await supabase.from('store_settings').update({ value: settings as any }).eq('key', 'whatsapp');
          } else {
            await supabase.from('store_settings').insert({ key: 'whatsapp', value: settings as any });
          }

          return new Response(JSON.stringify({
            success: true,
            display_name: settings.display_name,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: waData.error?.message || 'Failed to connect to WhatsApp API',
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (fetchErr) {
        return new Response(JSON.stringify({
          success: false,
          error: `Connection failed: ${fetchErr.message}`,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'disconnect') {
      await supabase.from('store_settings').update({
        value: { connected: false, api_url: '', api_token: '', phone_number_id: '' } as any,
      }).eq('key', 'whatsapp');

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'send_recovery') {
      // Send cart recovery message via WhatsApp
      const { to_phone, customer_name, cart_items, cart_total } = await req.json();

      const { data: waSettings } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'whatsapp')
        .single();

      const wa = waSettings?.value as any;
      if (!wa?.connected || !wa?.api_token) {
        return new Response(JSON.stringify({ success: false, error: 'WhatsApp not connected' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const itemList = (cart_items || []).map((i: any) => `• ${i.name} x${i.qty}`).join('\n');
      const message = `Hi ${customer_name || 'there'}! 👋\n\nYou left some items in your cart:\n${itemList}\n\nTotal: ₹${cart_total}\n\nComplete your order now and get free shipping! 🛒`;

      const sendUrl = `${wa.api_url.replace(/\/$/, '')}/${wa.phone_number_id}/messages`;
      const sendResp = await fetch(sendUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${wa.api_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to_phone,
          type: 'text',
          text: { body: message },
        }),
      });

      const sendData = await sendResp.json();
      return new Response(JSON.stringify({
        success: sendResp.ok,
        data: sendData,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
