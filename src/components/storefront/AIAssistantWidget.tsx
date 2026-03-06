import { useEffect } from 'react';
import { useGlobalStore } from '@/hooks/useGlobalStore';

export function AIAssistantWidget() {
  const { storeInfo } = useGlobalStore();

  useEffect(() => {
    // We need to fetch the ai_assistant config from store_settings
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

      // Inject inline script
      script = document.createElement('script');
      script.id = 'ai-assistant-widget';
      script.textContent = `
(function() {
  if (document.getElementById('ai-assistant-btn')) return;
  var SITE_ID = '${config.site_id}';
  var API_BASE = '${config.api_base}';
  var BTN_TEXT = '${(config.button_text || '✨ Need help choosing?').replace(/'/g, "\\'")}';

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

  var state = { questions:[], step:0, answers:{}, recs:[] };

  btn.onclick = async function() {
    btn.style.display = 'none';
    panel.classList.add('open');
    panel.innerHTML = '<div class="ai-body" style="text-align:center;padding:40px"><p>Loading...</p></div>';
    var surface = detectSurface();
    try {
      var res = await fetch(API_BASE + '/widget-config', {
        method:'POST',
        headers:{'Content-Type':'application/json','x-site-id':SITE_ID},
        body:JSON.stringify({ surface:surface.surface, pathname:location.pathname, productSlug:surface.slug })
      });
      var data = await res.json();
      state.questions = data.questions || [];
      state.step = 0;
      state.answers = {};
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
      body:JSON.stringify({ surface:surface.surface, pathname:location.pathname, productSlug:surface.slug, answers:state.answers })
    });
    var data = await res.json();
    renderRecommendations(data.recommendations || [], data.sessionId);
  }

  function renderRecommendations(recs, sessionId) {
    var html = '<div class="ai-header"><p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:hsl(var(--muted-foreground));margin:0">Results</p><h3>Your best matches</h3></div><div class="ai-body">';
    recs.forEach(function(r) {
      html += '<div class="ai-rec-card"><div style="display:flex;justify-content:space-between;align-items:start"><div><strong>'+r.name+'</strong><p style="font-size:13px;color:hsl(var(--muted-foreground));margin:4px 0">'+(r.explanation||r.description||'Recommended for you')+'</p></div><span class="ai-score">'+r.matchScore+'%</span></div>';
      if (r.productUrl) html += '<a href="'+r.productUrl+'" style="color:hsl(var(--primary));font-size:13px;font-weight:600;text-decoration:none">View product →</a>';
      html += '</div>';
    });
    html += '<button class="ai-next-btn" id="ai-close" style="background:hsl(var(--muted));color:hsl(var(--foreground));margin-top:16px">Close</button></div>';
    panel.innerHTML = html;

    document.getElementById('ai-close').onclick = function() {
      panel.classList.remove('open');
      btn.style.display = 'block';
    };

    fetch(API_BASE + '/widget-event', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-site-id':SITE_ID},
      body:JSON.stringify({ eventType:'recommendation_viewed', sessionId:sessionId, payload:{count:recs.length} })
    });
  }
})();
      `;
      document.body.appendChild(script);
    }

    loadWidget();

    return () => {
      cleanup = true;
      // Remove injected elements on unmount
      document.getElementById('ai-assistant-btn')?.remove();
      document.getElementById('ai-assistant-panel')?.remove();
      document.getElementById('ai-assistant-widget')?.remove();
    };
  }, []);

  return null;
}
