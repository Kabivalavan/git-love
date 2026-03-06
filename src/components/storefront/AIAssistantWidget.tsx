import { useEffect } from 'react';
import { useGlobalStore } from '@/hooks/useGlobalStore';

export function AIAssistantWidget() {
  const { storeInfo } = useGlobalStore();

  useEffect(() => {
    let script: HTMLScriptElement | null = null;
    let cleanup = false;

    async function loadWidget() {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data } = await supabase
        .from('store_settings')
        .select('value')
        .eq('key', 'ai_assistant')
        .single();

      if (cleanup) return;
      const config = data?.value as any;
      if (!config?.enabled || !config?.site_id || !config?.api_base) return;

      // Get current user for session tracking
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || '';
      const userEmail = session?.user?.email || '';

      // Get or create visitor ID
      let visitorId = localStorage.getItem('ai_visitor_id');
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem('ai_visitor_id', visitorId);
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      script = document.createElement('script');
      script.id = 'ai-assistant-widget';
      script.textContent = `
(function() {
  if (document.getElementById('ai-assistant-btn')) return;
  var SITE_ID = '${config.site_id}';
  var API_BASE = '${config.api_base}';
  var BTN_TEXT = '${(config.button_text || '✨ Need help choosing?').replace(/'/g, "\\'")}';
  var SUPABASE_URL = '${supabaseUrl}';
  var SUPABASE_KEY = '${supabaseKey}';
  var USER_ID = '${userId}';
  var USER_EMAIL = '${userEmail}';
  var VISITOR_ID = '${visitorId}';

  var style = document.createElement('style');
  style.textContent = \`
    #ai-assistant-btn { position:fixed; bottom:80px; right:24px; z-index:9998;
      background:linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/0.8)); color:hsl(var(--primary-foreground));
      border:none; border-radius:50px; padding:14px 24px; font-size:15px;
      font-weight:600; cursor:pointer; box-shadow:0 8px 32px rgba(0,0,0,.2);
      font-family:system-ui,-apple-system,sans-serif; transition:transform .2s; }
    #ai-assistant-btn:hover { transform:scale(1.05); }
    @media(min-width:1024px) { #ai-assistant-btn { bottom:24px; } }
    #ai-assistant-panel { display:none; position:fixed; bottom:80px; right:24px;
      z-index:9998; width:380px; max-width:calc(100vw - 32px); max-height:80vh;
      background:hsl(var(--card)); color:hsl(var(--card-foreground));
      border-radius:24px; box-shadow:0 20px 60px rgba(0,0,0,.15);
      font-family:system-ui,-apple-system,sans-serif; overflow:hidden; }
    @media(min-width:1024px) { #ai-assistant-panel { bottom:24px; } }
    #ai-assistant-panel.open { display:flex; flex-direction:column; }
    .ai-header { padding:20px; border-bottom:1px solid hsl(var(--border)); flex-shrink:0; }
    .ai-header h3 { margin:0; font-size:18px; }
    .ai-body { padding:20px; overflow-y:auto; flex:1; }
    .ai-option { display:block; width:100%; padding:12px 16px; margin:6px 0;
      border:1px solid hsl(var(--border)); border-radius:12px; background:hsl(var(--muted));
      cursor:pointer; text-align:left; font-size:14px; color:hsl(var(--foreground)); }
    .ai-option:hover { border-color:hsl(var(--primary)); background:hsl(var(--primary)/0.05); }
    .ai-option.selected { border-color:hsl(var(--primary)); background:hsl(var(--primary)/0.1); }
    .ai-next-btn { width:100%; padding:14px; margin-top:12px;
      background:linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/0.8)); color:hsl(var(--primary-foreground));
      border:none; border-radius:14px; font-size:15px; font-weight:600; cursor:pointer; }
    .ai-next-btn:disabled { opacity:.5; cursor:not-allowed; }
    .ai-rec-card { padding:16px; margin:8px 0; border:1px solid hsl(var(--border));
      border-radius:16px; background:hsl(var(--muted)); }
    .ai-score { background:hsl(var(--primary)/0.1); color:hsl(var(--primary)); padding:4px 10px;
      border-radius:20px; font-size:12px; font-weight:700; }
  \`;
  document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.id = 'ai-assistant-btn';
  btn.textContent = BTN_TEXT;
  document.body.appendChild(btn);

  var panel = document.createElement('div');
  panel.id = 'ai-assistant-panel';
  document.body.appendChild(panel);

  var state = { questions:[], step:0, answers:{}, recs:[], localSessionId:null };

  // Save session to Supabase
  function saveSession(payload) {
    try {
      fetch(SUPABASE_URL + '/rest/v1/ai_assistant_sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      }).then(function(r) { return r.json(); })
       .then(function(data) {
         if (data && data[0]) state.localSessionId = data[0].id;
       });
    } catch(e) { console.error('AI session save error', e); }
  }

  function updateSession(payload) {
    if (!state.localSessionId) return;
    try {
      fetch(SUPABASE_URL + '/rest/v1/ai_assistant_sessions?id=eq.' + state.localSessionId, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
        },
        body: JSON.stringify(payload)
      });
    } catch(e) { console.error('AI session update error', e); }
  }

  btn.onclick = async function() {
    btn.style.display = 'none';
    panel.classList.add('open');
    panel.innerHTML = '<div class="ai-body" style="text-align:center;padding:40px"><p>Loading...</p></div>';
    var surface = detectSurface();

    // Create local session record
    var sessionId = crypto.randomUUID();
    saveSession({
      session_id: sessionId,
      user_id: USER_ID || null,
      visitor_id: VISITOR_ID,
      surface: surface.surface,
      pathname: location.pathname,
      product_slug: surface.slug || null,
      started_at: new Date().toISOString()
    });

    try {
      var res = await fetch(API_BASE + '/widget-config', {
        method:'POST',
        headers:{'Content-Type':'application/json','x-site-id':SITE_ID},
        body:JSON.stringify({
          surface:surface.surface,
          pathname:location.pathname,
          productSlug:surface.slug,
          userId: USER_ID || undefined,
          userEmail: USER_EMAIL || undefined,
          visitorId: VISITOR_ID
        })
      });
      var data = await res.json();
      state.questions = data.questions || [];
      state.step = 0;
      state.answers = {};

      // Save questions to local session
      updateSession({ questions: state.questions });

      renderQuestion();
    } catch(e) {
      panel.innerHTML = '<div class="ai-body" style="text-align:center;padding:40px"><p>Failed to load. Please try again.</p><button class="ai-next-btn" onclick="document.getElementById(\\'ai-assistant-panel\\').classList.remove(\\'open\\');document.getElementById(\\'ai-assistant-btn\\').style.display=\\'block\\'">Close</button></div>';
    }
  };

  function detectSurface() {
    var path = location.pathname;
    if (path.match(/\\/products?\\/[^/]+/i)) {
      var slug = path.split('/').pop();
      return { surface:'product_page', slug:slug };
    }
    return { surface:'home', slug:null };
  }

  function renderQuestion() {
    var q = state.questions[state.step];
    if (!q) return;
    var html = '<div class="ai-header"><p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:hsl(var(--muted-foreground));margin:0">Step '+(state.step+1)+' of '+state.questions.length+'</p><h3>'+q.questionText+'</h3></div><div class="ai-body">';
    q.options.forEach(function(opt) {
      html += '<button class="ai-option" data-opt="'+opt+'">'+opt+'</button>';
    });
    html += '<button class="ai-next-btn" disabled id="ai-next">Continue</button></div>';
    panel.innerHTML = html;

    var selected = [];
    panel.querySelectorAll('.ai-option').forEach(function(el) {
      el.onclick = function() {
        if (q.inputType === 'single_select') {
          panel.querySelectorAll('.ai-option').forEach(function(o){o.classList.remove('selected')});
          el.classList.add('selected');
          selected = [el.dataset.opt];
        } else {
          el.classList.toggle('selected');
          selected = Array.from(panel.querySelectorAll('.ai-option.selected')).map(function(o){return o.dataset.opt});
        }
        document.getElementById('ai-next').disabled = selected.length === 0;
      };
    });

    document.getElementById('ai-next').onclick = function() {
      state.answers[q.id] = selected;
      state.step++;

      // Update answers in local session after each step
      updateSession({ answers: state.answers });

      if (state.step < state.questions.length) renderQuestion();
      else submitAnswers();
    };
  }

  async function submitAnswers() {
    panel.innerHTML = '<div class="ai-body" style="text-align:center;padding:40px"><p>Analyzing your preferences...</p></div>';
    var surface = detectSurface();
    var res = await fetch(API_BASE + '/widget-session', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-site-id':SITE_ID},
      body:JSON.stringify({
        surface:surface.surface,
        pathname:location.pathname,
        productSlug:surface.slug,
        answers:state.answers,
        userId: USER_ID || undefined,
        userEmail: USER_EMAIL || undefined,
        visitorId: VISITOR_ID
      })
    });
    var data = await res.json();
    var recs = data.recommendations || [];

    // Save recommendations and completion to local session
    updateSession({
      recommendations: recs,
      recommendation_count: recs.length,
      completed_at: new Date().toISOString()
    });

    renderRecommendations(recs, data.sessionId);
  }

  function renderRecommendations(recs, sessionId) {
    var html = '<div class="ai-header"><p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:hsl(var(--muted-foreground));margin:0">Results</p><h3>Your best matches</h3></div><div class="ai-body">';
    recs.forEach(function(r, idx) {
      html += '<div class="ai-rec-card"><div style="display:flex;justify-content:space-between;align-items:start"><div><strong>'+r.name+'</strong><p style="font-size:13px;color:hsl(var(--muted-foreground));margin:4px 0">'+(r.explanation||r.description||'Recommended for you')+'</p></div><span class="ai-score">'+r.matchScore+'%</span></div>';
      if (r.productUrl) html += '<a href="'+r.productUrl+'" data-rec-idx="'+idx+'" class="ai-rec-link" style="color:hsl(var(--primary));font-size:13px;font-weight:600;text-decoration:none">View product →</a>';
      html += '</div>';
    });
    html += '<button class="ai-next-btn" id="ai-close" style="background:hsl(var(--muted));color:hsl(var(--foreground));margin-top:16px">Close</button></div>';
    panel.innerHTML = html;

    // Track recommendation clicks
    panel.querySelectorAll('.ai-rec-link').forEach(function(link) {
      link.addEventListener('click', function() {
        updateSession({ clicked_product_url: link.getAttribute('href') });
      });
    });

    document.getElementById('ai-close').onclick = function() {
      panel.classList.remove('open');
      btn.style.display = 'block';
    };

    fetch(API_BASE + '/widget-event', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-site-id':SITE_ID},
      body:JSON.stringify({ eventType:'recommendation_viewed', sessionId:sessionId, payload:{count:recs.length, userId: USER_ID, visitorId: VISITOR_ID} })
    });
  }
})();
      `;
      document.body.appendChild(script);
    }

    loadWidget();

    return () => {
      cleanup = true;
      document.getElementById('ai-assistant-btn')?.remove();
      document.getElementById('ai-assistant-panel')?.remove();
      document.getElementById('ai-assistant-widget')?.remove();
    };
  }, []);

  return null;
}
