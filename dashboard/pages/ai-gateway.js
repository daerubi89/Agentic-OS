import { api, showToast, escapeHtml } from '../utils.js';

let state = { tab: 'Providers', config: {}, keysMasked: {}, providers: [], models: [] };

export async function render(container) {
  container.innerHTML = `
    <div class="page-header" style="margin-bottom:16px;">
      <h1 style="margin:0;">AI Gateway</h1>
      <div style="color:var(--text-secondary);">Manage providers, models, keys and OpenAI-compatible endpoint</div>
    </div>
    <div class="tabs" id="gwTabs" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;"></div>
    <div id="gwContent"></div>
  `;
  await loadAll();
  renderTabs();
  renderContent();
}

async function loadAll() {
  try {
    const [cfg, provs, models] = await Promise.all([
      api.gatewayConfig(),
      api.gatewayProviders(),
      api.gatewayModels()
    ]);
    state.config = cfg.config || {};
    state.keysMasked = cfg.keysMasked || {};
    state.providers = provs.providers || [];
    state.models = models.models || [];
  } catch (e) {
    showToast(e.message || 'Failed to load gateway', 'error');
  }
}

function renderTabs() {
  const tabs = ['Providers', 'Models', 'Keys', 'OpenAI Compatible', 'Settings'];
  const el = document.getElementById('gwTabs');
  el.innerHTML = tabs.map(t => `<button class="btn ${state.tab===t?'btn-primary':''}" data-tab="${t}">${t}</button>`).join('');
  el.querySelectorAll('[data-tab]').forEach(btn => {
    btn.onclick = () => { state.tab = btn.getAttribute('data-tab'); renderTabs(); renderContent(); };
  });
}

function renderContent() {
  const el = document.getElementById('gwContent');
  if (state.tab === 'Providers') renderProviders(el);
  else if (state.tab === 'Models') renderModels(el);
  else if (state.tab === 'Keys') renderKeys(el);
  else if (state.tab === 'OpenAI Compatible') renderOpenAI(el);
  else if (state.tab === 'Settings') renderSettings(el);
}

function renderProviders(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
        <div><h2 style="margin:0;">Providers</h2><div style="color:var(--text-secondary);font-size:12px;">Add custom providers like 9Router, OmniRoute or any OpenAI/Anthropic compatible</div></div>
        <button class="btn btn-primary" id="addProv">+ Add Custom Provider</button>
      </div>
      <div class="card-body" id="provList"></div>
    </div>
    <div id="provModal"></div>
  `;
  const list = document.getElementById('provList');
  list.innerHTML = (state.providers || []).map(p => `
    <div class="card" style="margin-bottom:12px;">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div><strong>${escapeHtml(p.name)}</strong> <span class="badge">${escapeHtml(p.id)}</span> ${p.enabled!==false?'':'<span class="badge">disabled</span>'} <span class="badge">${escapeHtml(p.type||'openai')}</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-sm" data-test="${escapeHtml(p.id)}">Test Connection</button>
          <button class="btn btn-sm" data-fetch="${escapeHtml(p.id)}">Fetch Models</button>
          <button class="btn btn-sm" data-edit="${escapeHtml(p.id)}">Edit</button>
          <button class="btn btn-sm btn-danger" data-del="${escapeHtml(p.id)}">Delete</button>
        </div>
      </div>
      <div class="card-body" style="color:var(--text-secondary);">
        <div>Base URL: ${escapeHtml(p.baseUrl||'')}</div>
        <div>Auth: ${escapeHtml(p.auth||'bearer')} | Models URL: ${escapeHtml(p.modelsUrl||'')}</div>
        ${p.notes ? `<div>${escapeHtml(p.notes)}</div>` : ''}
      </div>
    </div>
  `).join('') || '<div style="color:var(--text-secondary);">No providers</div>';

  list.querySelectorAll('[data-fetch]').forEach(btn => {
    btn.onclick = async () => {
      showToast('Fetching models...', 'info');
      try {
        const res = await api.gatewayFetchModels(btn.getAttribute('data-fetch'));
        showToast(`Fetched ${res.fetched||0} models`, 'success');
        const models = await api.gatewayModels();
        state.models = models.models || [];
        renderContent();
      } catch (e) {
        showToast(e.message || 'Failed', 'error');
      }
    };
  });
  list.querySelectorAll('[data-test]').forEach(btn => {
    btn.onclick = async () => {
      const pid = btn.getAttribute('data-test');
      const p = (state.providers||[]).find(x=>x.id===pid)||{};
      let key = '';
      const k = prompt(`Enter API key for ${p.name} (leave empty if none)`);
      if (k === null) return;
      key = k;
      try {
        const res = await api.gatewayProviderTest({ baseUrl: p.baseUrl, auth: p.auth, apiKey: key, modelsUrl: p.modelsUrl });
        if (res.ok) showToast(`Connected OK (${res.status})`, 'success');
        else showToast(`Failed (${res.status||res.error})`, 'error');
      } catch (e) {
        showToast(e.message || 'Test failed', 'error');
      }
    };
  });
  list.querySelectorAll('[data-edit]').forEach(btn => {
    btn.onclick = () => openProvModal(btn.getAttribute('data-edit'));
  });
  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Delete provider?')) return;
      await api.gatewayProviderDelete(btn.getAttribute('data-del'));
      await loadAll();
      renderContent();
    };
  });
  document.getElementById('addProv').onclick = () => openProvModal(null);
}

function openProvModal(editId) {
  const modal = document.getElementById('provModal');
  const p = editId ? (state.providers.find(x=>x.id===editId)||{}) : {id:'',name:'',enabled:true,baseUrl:'http://localhost:3000/v1',auth:'bearer',modelsUrl:'',type:'openai',notes:'',supportsModelsList:true};
  modal.innerHTML = `
    <div class="modal-backdrop" id="pb"></div>
    <div class="modal" style="max-width:650px;">
      <div class="modal-header"><h2>${editId?'Edit Provider':'Add Custom Provider'}</h2><button class="modal-close" id="pc">X</button></div>
      <div class="modal-body" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div><label>ID (unique)</label><input id="pv_id" class="input" value="${escapeHtml(p.id)}" ${editId?'disabled':''} placeholder="myprovider" /></div>
        <div><label>Name</label><input id="pv_name" class="input" value="${escapeHtml(p.name)}" placeholder="My Provider" /></div>
        <div style="grid-column:1/-1;"><label>Base URL (OpenAI/Anthropic compatible)</label><input id="pv_base" class="input" value="${escapeHtml(p.baseUrl||'')}" placeholder="http://localhost:3000/v1 or https://..." /></div>
        <div><label>Type</label><select id="pv_type" class="input"><option value="openai" ${p.type==='openai'?'selected':''}>openai</option><option value="anthropic" ${p.type==='anthropic'?'selected':''}>anthropic</option></select></div>
        <div><label>Auth</label><select id="pv_auth" class="input"><option value="bearer" ${p.auth==='bearer'?'selected':''}>bearer</option><option value="x-api-key" ${p.auth==='x-api-key'?'selected':''}>x-api-key</option><option value="none" ${p.auth==='none'?'selected':''}>none</option></select></div>
        <div><label>Enabled</label><select id="pv_enabled" class="input"><option value="true" ${p.enabled!==false?'selected':''}>true</option><option value="false" ${p.enabled===false?'selected':''}>false</option></select></div>
        <div><label>Supports Models List</label><select id="pv_supp" class="input"><option value="true" ${p.supportsModelsList!==false?'selected':''}>true</option><option value="false" ${p.supportsModelsList===false?'selected':''}>false</option></select></div>
        <div style="grid-column:1/-1;"><label>Models URL (optional, auto = baseUrl/models)</label><input id="pv_murl" class="input" value="${escapeHtml(p.modelsUrl||'')}" placeholder="http://localhost:3000/v1/models" /></div>
        <div style="grid-column:1/-1;"><label>Notes</label><input id="pv_notes" class="input" value="${escapeHtml(p.notes||'')}" placeholder="e.g. 9Router / OmniRoute" /></div>
      </div>
      <div class="modal-footer"><button class="btn" id="pca">Cancel</button><button class="btn btn-primary" id="psa">Save</button></div>
    </div>
  `;
  document.getElementById('pc').onclick=()=>modal.innerHTML='';
  document.getElementById('pca').onclick=()=>modal.innerHTML='';
  document.getElementById('pb').onclick=()=>modal.innerHTML='';
  document.getElementById('psa').onclick=async ()=>{
    const data = {
      id: (editId || document.getElementById('pv_id').value).trim(),
      name: document.getElementById('pv_name').value.trim(),
      enabled: document.getElementById('pv_enabled').value==='true',
      baseUrl: document.getElementById('pv_base').value.trim(),
      auth: document.getElementById('pv_auth').value,
      type: document.getElementById('pv_type').value,
      supportsModelsList: document.getElementById('pv_supp').value==='true',
      modelsUrl: document.getElementById('pv_murl').value.trim(),
      notes: document.getElementById('pv_notes').value.trim()
    };
    if (!data.id || !data.name || !data.baseUrl) { showToast('ID, Name, Base URL required', 'error'); return; }
    await api.gatewayProviderUpsert(data);
    modal.innerHTML='';
    await loadAll();
    renderContent();
    showToast('Provider saved', 'success');
  };
}

function renderModels(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div><h2 style="margin:0;">Models Catalog</h2><div style="color:var(--text-secondary);font-size:12px;">Discovered from providers or added manually</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn" id="clearModels">Clear All</button>
          <button class="btn btn-primary" id="addModel">+ Add Manual Model</button>
        </div>
      </div>
      <div class="card-body">
        <div style="margin-bottom:12px;"><input id="msearch" class="input" placeholder="Search models by name/id/provider..." /></div>
        <div style="overflow:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="text-align:left;"><th style="padding:8px;">Model</th><th style="padding:8px;">Provider</th><th style="padding:8px;">ID</th><th style="padding:8px;">OpenAI Compatible ID</th></tr></thead>
            <tbody id="mtable"></tbody>
          </table>
        </div>
        <div style="margin-top:8px;color:var(--text-secondary);font-size:12px;">Use in OpenAI-compatible endpoint as <code>provider:model_id</code></div>
      </div>
    </div>
    <div id="mmodal"></div>
  `;
  const table = document.getElementById('mtable');
  function draw(q='') {
    const list = (state.models||[]).filter(m => !q || ((m.id||'')+(m.name||'')+(m.provider||'')).toLowerCase().includes(q.toLowerCase()));
    table.innerHTML = list.slice(0,500).map(m => `<tr><td style="padding:8px;">${escapeHtml(m.name||m.id)}</td><td style="padding:8px;">${escapeHtml(m.provider)}</td><td style="padding:8px;">${escapeHtml(m.id)}</td><td style="padding:8px;"><code>${escapeHtml(m.provider)}:${escapeHtml(m.id)}</code></td></tr>`).join('') || '<tr><td colspan="4" style="padding:8px;color:var(--text-secondary);">No models yet. Fetch from Providers or add manually.</td></tr>';
  }
  draw();
  document.getElementById('msearch').oninput = (e)=>draw(e.target.value);
  document.getElementById('clearModels').onclick = async ()=>{
    if (!confirm('Clear all models?')) return;
    await api.gatewayModelsClear('');
    const models = await api.gatewayModels();
    state.models = models.models||[];
    renderContent();
    showToast('Cleared', 'success');
  };
  document.getElementById('addModel').onclick = ()=>{
    const mmodal = document.getElementById('mmodal');
    mmodal.innerHTML = `
      <div class="modal-backdrop" id="mb2"></div>
      <div class="modal" style="max-width:500px;">
        <div class="modal-header"><h2>Add Manual Model</h2><button class="modal-close" id="mc2">X</button></div>
        <div class="modal-body" style="display:grid;gap:12px;">
          <div><label>Provider ID</label><input id="mm_prov" class="input" placeholder="9router or openrouter" /></div>
          <div><label>Model ID</label><input id="mm_id" class="input" placeholder="gpt-4o or deepseek-chat" /></div>
          <div><label>Name (optional)</label><input id="mm_name" class="input" placeholder="Display name" /></div>
        </div>
        <div class="modal-footer"><button class="btn" id="mca2">Cancel</button><button class="btn btn-primary" id="msa2">Save</button></div>
      </div>
    `;
    document.getElementById('mc2').onclick=()=>mmodal.innerHTML='';
    document.getElementById('mb2').onclick=()=>mmodal.innerHTML='';
    document.getElementById('mca2').onclick=()=>mmodal.innerHTML='';
    document.getElementById('msa2').onclick=async ()=>{
      await api.gatewayModelsManual({provider:document.getElementById('mm_prov').value,id:document.getElementById('mm_id').value,name:document.getElementById('mm_name').value});
      mmodal.innerHTML='';
      const models = await api.gatewayModels();
      state.models = models.models||[];
      renderContent();
      showToast('Added', 'success');
    };
  };
}

function renderKeys(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header"><h2>API Keys</h2></div>
      <div class="card-body">
        <div style="color:var(--text-secondary);margin-bottom:12px;">Keys are stored locally. Saved values are not shown in full.</div>
        <div id="keysList" style="display:grid;gap:12px;"></div>
        <div style="margin-top:16px;"><button class="btn btn-primary" id="saveKeys">Save Keys</button></div>
      </div>
    </div>
  `;
  const list = document.getElementById('keysList');
  const keys = {};
  list.innerHTML = (state.providers||[]).map(p => `
    <div style="display:grid;grid-template-columns:200px 1fr;align-items:center;gap:12px;">
      <div><strong>${escapeHtml(p.name)}</strong><div style="color:var(--text-secondary);font-size:12px;">${escapeHtml(p.id)}</div></div>
      <input class="input" data-key="${escapeHtml(p.id)}" placeholder="${state.keysMasked[p.id] ? '******** (masked) - enter to replace' : 'Enter API key'}" />
    </div>
  `).join('');
  document.getElementById('saveKeys').onclick = async ()=>{
    list.querySelectorAll('input[data-key]').forEach(inp => {
      const v = inp.value.trim();
      if (v) keys[inp.getAttribute('data-key')] = v;
    });
    await api.gatewayConfigSave({ config: state.config, keys });
    showToast('Keys saved', 'success');
    const cfg = await api.gatewayConfig();
    state.keysMasked = cfg.keysMasked||{};
    renderContent();
  };
}

function renderOpenAI(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header"><h2>OpenAI Compatible Endpoint</h2></div>
      <div class="card-body">
        <div style="margin-bottom:12px;"><strong>Base URL:</strong> <code>http://127.0.0.1:8080/v1</code></div>
        <div style="margin-bottom:12px;"><strong>Models:</strong> <code>GET http://127.0.0.1:8080/v1/models</code></div>
        <div style="margin-bottom:12px;"><strong>Chat:</strong> <code>POST http://127.0.0.1:8080/v1/chat/completions</code></div>
        <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;overflow:auto;">
<pre style="margin:0;">curl http://127.0.0.1:8080/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"model":"openrouter:deepseek-chat","messages":[{"role":"user","content":"hello"}]}'</pre>
        </div>
        <div style="margin-top:12px;color:var(--text-secondary);">Use model format <code>provider:model_id</code> (e.g. groq:llama-3.1-8b-instant)</div>
      </div>
    </div>
  `;
}

function renderSettings(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header"><h2>Gateway Settings</h2></div>
      <div class="card-body" style="display:grid;gap:12px;max-width:500px;">
        <div><label>Enabled</label><select id="gs_enabled" class="input"><option value="true" ${state.config.enabled!==false?'selected':''}>true</option><option value="false" ${state.config.enabled===false?'selected':''}>false</option></select></div>
        <div><label>Expose OpenAI Compatible</label><select id="gs_openai" class="input"><option value="true" ${state.config.exposeOpenAICompat!==false?'selected':''}>true</option><option value="false" ${state.config.exposeOpenAICompat===false?'selected':''}>false</option></select></div>
        <div><button class="btn btn-primary" id="gs_save">Save Settings</button></div>
      </div>
    </div>
  `;
  document.getElementById('gs_save').onclick = async ()=>{
    state.config.enabled = document.getElementById('gs_enabled').value==='true';
    state.config.exposeOpenAICompat = document.getElementById('gs_openai').value==='true';
    await api.gatewayConfigSave({ config: state.config, keys: {} });
    showToast('Settings saved', 'success');
  };
}

window.renderAiGateway = render;
