import { api, showToast, escapeHtml } from '../utils.js';

export async function render(container) {
  container.innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
      <div>
        <h1 style="margin:0;">Agent Manager</h1>
        <div style="color:var(--text-secondary);">Add unlimited custom agents (CLI, HTTP, OpenAI Compatible). Supports Codex, Cursor, Devin, Amp, RooCode, Continue, Aider, Cline, etc.</div>
      </div>
      <button class="btn btn-primary" id="addAgent">+ Add Custom Agent</button>
    </div>
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header"><h2>All Agents (Built-in + Custom)</h2></div>
      <div class="card-body" id="agentList">Loading...</div>
    </div>
    <div id="agentModal"></div>
  `;

  document.getElementById('addAgent').onclick = () => openModal();
  await load();
}

async function load() {
  try {
    const res = await api.getAllAgents();
    const agents = res.agents || [];
    const list = document.getElementById('agentList');
    if (agents.length === 0) {
      list.innerHTML = '<div style="color:var(--text-secondary);">No agents found.</div>';
      return;
    }
    list.innerHTML = agents.map(a => `
      <div class="card" style="margin-bottom:12px;">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
          <div><span style="margin-right:8px;">${escapeHtml(a.icon || '🤖')}</span><strong>${escapeHtml(a.name || a.id)}</strong> <span class="badge">${escapeHtml(a.type || 'custom')}</span></div>
          <div style="display:flex;gap:8px;">
            ${a.type === 'builtin' ? '' : `<button class="btn btn-sm" data-edit="${escapeHtml(a.id)}">Edit</button><button class="btn btn-sm btn-danger" data-del="${escapeHtml(a.id)}">Delete</button>`}
          </div>
        </div>
        <div class="card-body" style="color:var(--text-secondary);">
          <div>ID: ${escapeHtml(a.id)}</div>
          ${a.description ? `<div>${escapeHtml(a.description)}</div>` : ''}
          ${a.type === 'openai_compatible' ? `<div>Base URL: ${escapeHtml(a.baseUrl || '')} | Model: ${escapeHtml(a.model || '')}</div>` : ''}
          ${a.type === 'cli' ? `<div>Command: ${escapeHtml(a.command || '')}</div>` : ''}
          ${a.type === 'http' ? `<div>Endpoint: ${escapeHtml(a.endpoint || '')}</div>` : ''}
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-edit]').forEach(btn => {
      btn.onclick = () => openModal(btn.getAttribute('data-edit'));
    });
    list.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Delete this custom agent?')) return;
        try {
          await api.deleteCustomAgent(btn.getAttribute('data-del'));
          showToast('Agent deleted', 'success');
          await load();
        } catch (e) {
          showToast(e.message || 'Failed to delete', 'error');
        }
      };
    });
  } catch (e) {
    document.getElementById('agentList').innerHTML = `<div style="color:var(--red);">${escapeHtml(e.message || 'Failed to load')}</div>`;
  }
}

async function openModal(editId = null) {
  const modal = document.getElementById('agentModal');
  modal.innerHTML = `
    <div class="modal-backdrop" id="mback"></div>
    <div class="modal" style="max-width:750px;max-height:92vh;overflow:auto;">
      <div class="modal-header"><h2>${editId ? 'Edit Custom Agent' : 'Add Custom Agent'}</h2><button class="modal-close" id="mclose">X</button></div>
      <div class="modal-body">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
          <div style="grid-column:1/3;"><label>Name</label><input id="m_name" class="input" placeholder="e.g. Codex, Cursor, Devin, Amp, Continue" /></div>
          <div><label>Icon</label><input id="m_icon" class="input" value="🤖" /></div>
          <div style="grid-column:1/3;"><label>Type</label><select id="m_type" class="input"><option value="openai_compatible">OpenAI Compatible (recommended for providers/gateways)</option><option value="cli">CLI (codex/cursor/devin/amp/aider/cline/roo)</option><option value="http">HTTP API</option><option value="script">Script</option></select></div>
          <div><label>Enabled</label><select id="m_enabled" class="input"><option value="true">true</option><option value="false">false</option></select></div>
          <div style="grid-column:1/4;"><label>Timeout (seconds)</label><input id="m_timeout" class="input" type="number" value="120" /></div>
          <div style="grid-column:1/-1;"><label>Description</label><input id="m_desc" class="input" placeholder="Describe what this agent is for" /></div>
        </div>
        <div id="m_fields" style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px;"></div>
      </div>
      <div class="modal-footer"><button class="btn" id="mcancel">Cancel</button><button class="btn btn-primary" id="msave">Save Agent</button></div>
    </div>
  `;
  document.getElementById('mclose').onclick = closeModal;
  document.getElementById('mcancel').onclick = closeModal;
  document.getElementById('mback').onclick = closeModal;
  const typeSel = document.getElementById('m_type');
  typeSel.onchange = renderFields;
  renderFields();

  if (editId) {
    try {
      const all = await api.getAllAgents();
      const a = (all.agents || []).find(x => x.id === editId && x.type !== 'builtin');
      if (a) {
        document.getElementById('m_name').value = a.name || '';
        document.getElementById('m_icon').value = a.icon || '🤖';
        document.getElementById('m_type').value = a.type || 'openai_compatible';
        document.getElementById('m_enabled').value = a.enabled === false ? 'false' : 'true';
        document.getElementById('m_desc').value = a.description || '';
        document.getElementById('m_timeout').value = a.timeout || 120;
        renderFields(a);
      }
    } catch (e) {}
  }

  document.getElementById('msave').onclick = async () => {
    const type = document.getElementById('m_type').value;
    const payload = {
      name: document.getElementById('m_name').value,
      icon: document.getElementById('m_icon').value,
      type,
      enabled: document.getElementById('m_enabled').value === 'true',
      description: document.getElementById('m_desc').value,
      timeout: parseInt(document.getElementById('m_timeout').value || '120')
    };
    if (type === 'openai_compatible') {
      payload.baseUrl = document.getElementById('mf_baseUrl').value;
      payload.apiKey = document.getElementById('mf_apiKey').value;
      payload.model = document.getElementById('mf_model').value;
      payload.headers = {};
    } else if (type === 'cli' || type === 'script') {
      payload.command = document.getElementById('mf_command').value;
      payload.args = (document.getElementById('mf_args').value || '').split(',').map(x=>x.trim()).filter(Boolean);
      payload.cwd = document.getElementById('mf_cwd') ? document.getElementById('mf_cwd').value : '';
      payload.env = {};
    } else if (type === 'http') {
      payload.endpoint = document.getElementById('mf_endpoint').value;
      payload.method = document.getElementById('mf_method').value;
      payload.headers = { 'Content-Type': 'application/json' };
      payload.bodyTemplate = { message: '{message}' };
      payload.responsePath = document.getElementById('mf_responsePath').value || '';
    }
    try {
      if (editId) await api.updateCustomAgent(editId, payload);
      else await api.createCustomAgent(payload);
      showToast('Agent saved', 'success');
      closeModal();
      await load();
    } catch (e) {
      showToast(e.message || 'Failed to save', 'error');
    }
  };
}

function renderFields(a = {}) {
  const type = document.getElementById('m_type').value;
  const f = document.getElementById('m_fields');
  if (type === 'openai_compatible') {
    f.innerHTML = `
      <div style="grid-column:1/-1;"><label>Base URL</label><input id="mf_baseUrl" class="input" value="${escapeHtml(a.baseUrl||'http://127.0.0.1:1234/v1')}" /></div>
      <div><label>API Key (optional)</label><input id="mf_apiKey" class="input" value="${escapeHtml(a.apiKey||'')}" /></div>
      <div><label>Model</label><input id="mf_model" class="input" value="${escapeHtml(a.model||'')}" /></div>
    `;
  } else if (type === 'cli') {
    f.innerHTML = `
      <div style="grid-column:1/-1;"><label>Command</label><input id="mf_command" class="input" value="${escapeHtml(a.command||'')}" placeholder="/path/to/agent or binary" /></div>
      <div style="grid-column:1/-1;"><label>Args (comma separated, use {message})</label><input id="mf_args" class="input" value="${(a.args||[]).join(', ')}" placeholder="--prompt, {message}" /></div>
    `;
  } else if (type === 'http') {
    f.innerHTML = `
      <div style="grid-column:1/-1;"><label>Endpoint</label><input id="mf_endpoint" class="input" value="${escapeHtml(a.endpoint||'http://localhost:9000/agent/run')}" /></div>
      <div><label>Method</label><select id="mf_method" class="input"><option value="POST" ${a.method==='GET'?'':'selected'}>POST</option><option value="GET" ${a.method==='GET'?'selected':''}>GET</option></select></div>
      <div><label>Response Path (optional)</label><input id="mf_responsePath" class="input" value="${escapeHtml(a.responsePath||'')}" placeholder="data.response" /></div>
    `;
  } else {
    f.innerHTML = `<div style="grid-column:1/-1;color:var(--text-secondary);">Script type uses CLI style.</div>`;
  }
}

function closeModal() {
  document.getElementById('agentModal').innerHTML = '';
}

window.renderAgentsManager = render;
