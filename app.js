/* Roam WhatsApp Outreach Console — all data lives in this browser's localStorage. */
(function () {
  'use strict';

  const L = window.RoamLib;
  const cloud = window.RoamCloud || { enabled: false };
  const STORE_KEY = 'roam-wa-console-v1';
  // Bump on each release so you can tell which version a deployment is serving (shown in Settings).
  const APP_VERSION = '1.7 — opening counts as sent, Not on WhatsApp';
  const MODE_KEY = 'roam-wa-mode'; // 'local' when the user chose to skip signing in

  // ---------------------------------------------------------------------------
  // Defaults
  // ---------------------------------------------------------------------------

  const DEFAULT_TEMPLATES = [
    {
      name: 'Roam — Property Introduction',
      category: 'Introduction',
      body:
        'Hi there,\n\n' +
        'I came across {{property_name}} in {{city}} and wanted to reach out.\n\n' +
        'I’m building Roam — a digital guest experience platform for properties like yours. It gives guests a simple way to access property information, local recommendations, experiences, services and support, all from their phone without downloading an app.\n\n' +
        'I’d love to show you what it looks like.\n\n' +
        'Would you be open to taking a quick look?',
    },
    {
      name: 'Roam — Short Introduction',
      category: 'Introduction',
      body:
        'Hi! I came across {{property_name}} and wanted to reach out.\n\n' +
        'I’m building Roam — a digital concierge that gives your guests everything they need (property info, local tips, experiences and support) right on their phone, no app needed.\n\n' +
        'Open to a quick look?',
    },
    {
      name: 'Roam — Luxury Villa',
      category: 'Luxury Villa',
      body:
        'Hi there,\n\n' +
        'I came across {{property_name}} in {{city}} — a beautiful villa.\n\n' +
        'I’m building Roam, a digital concierge for luxury stays. Guests get a private, beautifully designed guide on their phone: villa details, house rules, curated local recommendations, experiences like private chefs, transfers and tours, and direct support — no app to download.\n\n' +
        'It helps you deliver a five-star experience while your team answers far fewer repeat questions.\n\n' +
        'Would you be open to a quick look?',
    },
    {
      name: 'Roam — Boutique Hotel',
      category: 'Boutique Hotel',
      body:
        'Hi {{property_name}} team,\n\n' +
        'I came across your hotel in {{city}} and really liked what you’ve built.\n\n' +
        'I’m building Roam — a digital guest experience platform for boutique hotels. Guests scan a QR code and instantly have everything on their phone: hotel information, amenities, local recommendations, experiences and services they can request, and a direct line to your team. No app download.\n\n' +
        'It takes pressure off the front desk and opens new ways to offer guests extras.\n\n' +
        'Would you be open to taking a quick look?',
    },
    {
      name: 'Roam — Vacation Rental',
      category: 'Vacation Rental',
      body:
        'Hi there,\n\n' +
        'I came across {{property_name}} in {{city}} and wanted to reach out.\n\n' +
        'I’m building Roam — a digital guest guide for vacation rentals. Every guest gets check-in instructions, Wi-Fi, house rules, local recommendations, experiences and support on their phone, without downloading an app.\n\n' +
        'For hosts and property managers that means fewer repeat questions, smoother check-ins and better reviews — across all your properties.\n\n' +
        'Would you be open to a quick look?',
    },
    {
      name: 'Roam — Follow-up',
      category: 'Follow-up',
      body:
        'Hi, just following up on my message about Roam for {{property_name}}.\n\n' +
        'Happy to send over a short demo so you can see how it would look for your guests — would that be helpful?',
    },
    {
      name: 'Roam — Demo Follow-up',
      category: 'Follow-up',
      body:
        'Hi, thanks again for taking the time to look at Roam!\n\n' +
        'I’d love to hear what you thought. If it’s helpful, I can set up a version for {{property_name}} so you can see it with your own property details.\n\n' +
        'Any questions I can answer?',
    },
  ];

  const CATEGORIES = ['Introduction', 'Luxury Villa', 'Boutique Hotel', 'Vacation Rental', 'Airbnb Host', 'Property Manager', 'Follow-up'];

  const PROPERTY_TYPES = [
    'Airbnb', 'luxury villa', 'villa', 'vacation rental', 'boutique hotel', 'boutique stay',
    'hotel', 'apartment', 'guesthouse', 'property management company',
  ];

  /** Known variables and how they map to contact fields. Anything else is a free-form custom variable. */
  const KNOWN_VARS = {
    first_name: { label: 'First name', placeholder: 'Carlos', from: (c) => L.firstName(c.name) },
    property_name: { label: 'Property', placeholder: 'Casa Libia', from: (c) => c.propertyName },
    city: { label: 'Location', placeholder: 'Medellín', from: (c) => c.city },
    property_type: { label: 'Property type', placeholder: 'villa', from: (c) => c.propertyType, list: 'pt-list' },
    country: { label: 'Country', placeholder: 'Colombia', from: (c) => c.country },
  };

  const DETAIL_FIELDS = [
    ['name', 'Full name', 'Carlos Restrepo'],
    ['country', 'Country', 'Colombia'],
    ['website', 'Website', 'casalibia.com'],
    ['instagram', 'Instagram', '@casalibia'],
    ['email', 'Email', 'carlos@casalibia.com'],
  ];

  const CONTACT_FIELDS = [
    ['name', 'Name'], ['propertyName', 'Property name'], ['phone', 'WhatsApp number'],
    ['country', 'Country'], ['city', 'Location'], ['propertyType', 'Property type'],
    ['website', 'Website'], ['instagram', 'Instagram'], ['email', 'Email'], ['notes', 'Notes'],
  ];

  // ---------------------------------------------------------------------------
  // Storage
  // ---------------------------------------------------------------------------

  const uid = () => {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };
  const nowIso = () => new Date().toISOString();

  function seedTemplates() {
    return DEFAULT_TEMPLATES.map((t) => ({ id: uid(), active: true, createdAt: nowIso(), ...t }));
  }

  /** Upgrade built-in templates the user never edited to the current wording. */
  function migrateTemplates(data) {
    if (!Array.isArray(data.templates)) return;
    for (const t of data.templates) {
      const def = DEFAULT_TEMPLATES.find((d) => d.name === t.name);
      if (def && !t.updatedAt && t.body !== def.body && /\{\{\s*first_name\s*\}\}/.test(t.body)) t.body = def.body;
    }
  }

  function freshDb() {
    return {
      version: 1,
      folders: [],
      templates: seedTemplates(),
      contacts: [],
      outreach: [],
      settings: { defaultCountryCode: '', openMode: 'auto', lastTemplateId: null, counterResetAt: null },
    };
  }

  /** Read a saved copy from this browser; null when there is none. */
  function readLocal(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Could not read saved data', e);
    }
    return null;
  }

  /**
   * The fullest copy of an account's data cached in this browser, from any account (e.g. one whose
   * database project no longer exists). Used once, to fill a brand-new, empty account.
   */
  function largestCachedCopy() {
    let best = null;
    let bestSize = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(STORE_KEY + ':')) continue;
        const data = readLocal(key);
        const size = data ? (data.contacts || []).length + (data.outreach || []).length : 0;
        if (size > bestSize) { best = data; bestSize = size; }
      }
    } catch (e) { /* storage unavailable */ }
    return best;
  }

  /** Fill in anything missing from older or partial data. */
  function normalizeDb(data) {
    migrateTemplates(data);
    const base = freshDb();
    const merged = { ...base, ...data, settings: { ...base.settings, ...(data.settings || {}) } };
    // Opening WhatsApp counts as sent: upgrade entries recorded as only "opened".
    for (const o of merged.outreach || []) {
      if (o.status !== 'opened') continue;
      o.status = 'sent';
      o.sentAt = o.sentAt || o.openedAt;
      const c = (merged.contacts || []).find((x) => x.id === o.contactId);
      if (c && (!c.lastSentAt || c.lastSentAt < o.sentAt)) c.lastSentAt = o.sentAt;
    }
    // Quick Send needs templates to pick from; bring back the built-in ones if the list is empty.
    if (!Array.isArray(merged.templates) || !merged.templates.length) merged.templates = seedTemplates();
    return merged;
  }

  // In cloud mode the browser copy is a per-user cache; in local mode it is the only copy.
  let storeKey = STORE_KEY;
  let db = freshDb();
  let storageOk = true;

  function save() {
    try {
      localStorage.setItem(storeKey, JSON.stringify(db));
      storageOk = true;
    } catch (e) {
      if (storageOk && !cloudActive()) toast('Could not save — browser storage is unavailable. Export a backup from Settings.', 'warn');
      storageOk = false;
    }
    if (cloudActive()) schedulePush();
  }

  // ---------------------------------------------------------------------------
  // Cloud sync (Supabase)
  // ---------------------------------------------------------------------------

  const sync = { snapshot: null, timer: null, pushing: false, dirty: false, state: 'off', error: '' };
  const cloudActive = () => !!(cloud.enabled && cloud.user && ui.ready);

  function getMode() {
    try { return localStorage.getItem(MODE_KEY) || 'cloud'; } catch (e) { return 'cloud'; }
  }
  function setMode(m) {
    try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* ignore */ }
  }

  function setSync(state, error) {
    sync.state = state;
    sync.error = error || '';
    const el = $('#sync');
    if (!el) return;
    const labels = { off: '', loading: 'Loading…', saving: 'Saving…', synced: 'Saved', error: 'Not saved — retrying' };
    el.textContent = labels[state] || '';
    el.className = 'sync sync-' + state;
    el.title = state === 'error' ? `Couldn’t reach the database (${sync.error}). Changes are kept in this browser and will be retried.` :
      state === 'synced' ? 'All changes saved to the database' : '';
  }

  function schedulePush(delay) {
    sync.dirty = true;
    if (sync.state !== 'error') setSync('saving');
    clearTimeout(sync.timer);
    sync.timer = setTimeout(pushNow, delay == null ? 400 : delay);
  }

  async function pushNow() {
    if (sync.pushing) { schedulePush(); return; }
    sync.pushing = true;
    sync.dirty = false;
    try {
      sync.snapshot = await cloud.push(db, sync.snapshot);
      if (!sync.dirty) setSync('synced');
    } catch (e) {
      console.warn('Sync failed', e);
      setSync('error', e.message || String(e));
      schedulePush(8000);
    } finally {
      sync.pushing = false;
    }
  }

  async function flushSync() {
    if (!cloudActive()) return;
    clearTimeout(sync.timer);
    if (sync.dirty || sync.state === 'error') await pushNow();
  }

  /** Load the signed-in user's data, carrying over this browser's data on their first sign-in. */
  async function startCloud() {
    storeKey = STORE_KEY + ':' + cloud.user.id;
    ui.auth = null;
    setSync('loading');
    try {
      const remote = await cloud.pull();
      if (remote.empty) {
        const existing = readLocal(storeKey) || readLocal(STORE_KEY) || largestCachedCopy();
        db = existing ? normalizeDb(existing) : freshDb();
        sync.snapshot = null; // upload everything
        ui.ready = true;
        save();
        await flushSync();
        if (existing && (existing.contacts || []).length) toast(`Uploaded ${existing.contacts.length} contacts from this browser to your account.`);
      } else {
        const serverSnap = cloud.snapshot(remote.data); // before normalizing, which may upgrade templates
        db = normalizeDb(remote.data);
        sync.snapshot = serverSnap;
        ui.ready = true;
        save(); // caches locally and schedules a push
        if (JSON.stringify(cloud.snapshot(db)) === JSON.stringify(serverSnap)) {
          clearTimeout(sync.timer); sync.dirty = false; setSync('synced');
        }
      }
    } catch (e) {
      console.warn('Could not load from the database', e);
      const cached = readLocal(storeKey);
      db = cached ? normalizeDb(cached) : freshDb();
      sync.snapshot = null;
      ui.ready = true;
      setSync('error', e.message || String(e));
      toast('Couldn’t reach the database — using this browser’s copy. Changes will sync when it’s back.', 'warn');
      schedulePush(8000);
    }
    ui.qs = freshQS();
    render();
  }

  /** Refresh from the database when coming back to the tab (e.g. after using another device). */
  async function refreshFromCloud() {
    if (!cloudActive() || sync.dirty || sync.pushing || sync.state === 'error') return;
    if (ui.view === 'templates' || !$('#modal').hidden) return; // don't swap data under an open editor
    try {
      const remote = await cloud.pull();
      if (sync.dirty || sync.pushing) return;
      const next = normalizeDb(remote.data);
      const snap = cloud.snapshot(next);
      if (JSON.stringify(snap) === JSON.stringify(sync.snapshot)) return;
      db = next;
      sync.snapshot = snap;
      try { localStorage.setItem(storeKey, JSON.stringify(db)); } catch (e) { /* cache only */ }
      if (ui.view === 'send') { renderRecents(); updatePhoneHint(); } else render();
      updateNavBadge();
    } catch (e) { /* stay on the current copy */ }
  }

  function startLocal() {
    storeKey = STORE_KEY;
    const saved = readLocal(STORE_KEY);
    db = saved ? normalizeDb(saved) : freshDb();
    ui.auth = null;
    ui.ready = true;
    setSync('off');
    save(); // Persist first-run seed data and any template migrations.
    ui.qs = freshQS();
    render();
  }

  // ---------------------------------------------------------------------------
  // Data helpers
  // ---------------------------------------------------------------------------

  const getTemplate = (id) => db.templates.find((t) => t.id === id);
  const getContact = (id) => db.contacts.find((c) => c.id === id);
  const getOutreach = (id) => db.outreach.find((o) => o.id === id);
  const contactByPhone = (digits) => (digits ? db.contacts.find((c) => c.phone === digits) : null);
  const activeTemplates = () => db.templates.filter((t) => t.active);
  const getFolder = (id) => (id ? (db.folders || []).find((f) => f.id === id) : null);
  const folderOf = (c) => getFolder(c.folderId);
  const sortedFolders = () => (db.folders || []).slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  /** Find a folder by name (case-insensitive) or create it. */
  function ensureFolder(name) {
    const clean = String(name || '').trim().slice(0, 80);
    if (!clean) return null;
    const found = db.folders.find((f) => f.name.toLowerCase() === clean.toLowerCase());
    if (found) return found;
    const f = { id: uid(), name: clean, createdAt: nowIso() };
    db.folders.push(f);
    return f;
  }

  function folderOptions(selectedId, { none = 'No folder', allowNew = true } = {}) {
    return `<option value="">${esc(none)}</option>` +
      sortedFolders().map((f) => `<option value="${f.id}"${f.id === selectedId ? ' selected' : ''}>${esc(f.name)}</option>`).join('') +
      (allowNew ? '<option value="__new">+ New folder…</option>' : '');
  }

  function defaultTemplateId() {
    const last = getTemplate(db.settings.lastTemplateId);
    if (last && last.active) return last.id;
    const first = activeTemplates().find((t) => t.category !== 'Follow-up') || activeTemplates()[0];
    return first ? first.id : null;
  }

  function defaultFollowUpTemplateId() {
    const fu = activeTemplates().find((t) => /follow/i.test(t.category) && !/demo/i.test(t.name)) ||
      activeTemplates().find((t) => /follow/i.test(t.category));
    return fu ? fu.id : defaultTemplateId();
  }

  /** Template category that best fits a property type, used for the "Suggested" chip. */
  function categoryForPropertyType(pt) {
    const s = String(pt || '').toLowerCase();
    if (!s) return null;
    if (/villa|luxury/.test(s)) return 'Luxury Villa';
    if (/hotel|boutique|hostel|inn|lodge/.test(s)) return 'Boutique Hotel';
    if (/airbnb|host/.test(s)) return activeTemplates().some((t) => t.category === 'Airbnb Host') ? 'Airbnb Host' : 'Vacation Rental';
    if (/manag/.test(s)) return activeTemplates().some((t) => t.category === 'Property Manager') ? 'Property Manager' : 'Vacation Rental';
    if (/rental|apartment|condo|house|cabin|guesthouse/.test(s)) return 'Vacation Rental';
    return null;
  }

  function contactStatus(c) {
    if (c.noWhatsapp) return { key: 'nowa', label: 'Not on WhatsApp' };
    if (c.followUp) {
      const d = L.daysUntil(c.followUp.due);
      if (d <= 0) return { key: 'due', label: 'Follow-up due' };
      return { key: 'scheduled', label: 'Follow-up ' + fmtDue(c.followUp.due) };
    }
    if (c.lastSentAt) return { key: 'sent', label: 'Contacted' };
    if (c.lastOpenedAt) return { key: 'opened', label: 'Opened' };
    return { key: 'new', label: 'New' };
  }

  function dueFollowUps() {
    return db.contacts.filter((c) => c.followUp && L.daysUntil(c.followUp.due) <= 0);
  }

  // ---------------------------------------------------------------------------
  // Formatting
  // ---------------------------------------------------------------------------

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function fmtRelative(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const days = -L.daysUntil(L.localDate(d));
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (days === 0) return 'Today ' + time;
    if (days === 1) return 'Yesterday ' + time;
    if (days < 7) return days + ' days ago';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }

  function fmtDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  }

  function fmtDue(ymd) {
    const n = L.daysUntil(ymd);
    if (n === 0) return 'today';
    if (n === 1) return 'tomorrow';
    if (n === -1) return 'yesterday';
    if (n < 0) return `${-n} days overdue`;
    if (n < 7) return `in ${n} days`;
    const [y, m, d] = ymd.split('-').map(Number);
    return 'on ' + new Date(y, m - 1, d).toLocaleDateString([], { day: 'numeric', month: 'short' });
  }

  const contactLabel = (c) => c.propertyName || c.name || L.formatPhone(c.phone);
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const modKey = isMac ? '⌘' : 'Ctrl';

  // ---------------------------------------------------------------------------
  // UI state
  // ---------------------------------------------------------------------------

  const ui = {
    ready: false, // data loaded (signed in, or browser-only mode)
    auth: null, // { mode: 'signin' | 'signup', message } while signed out
    view: 'send',
    qs: freshQS(),
    pending: null, // { outreachId, stage: 'confirm' | 'followup' | 'done' }
    historyFilter: 'all',
    historySelected: new Set(), // outreach ids ticked in History
    historySearch: '',
    contactSearch: '',
    folder: 'all', // Contacts filter: 'all', 'none' or a folder id
    selected: new Set(), // contact ids ticked in the Contacts table
    tplSelected: null,
    queue: loadQueuePrefs(), // lead list on Quick Send: { folder, filter: 'todo' | 'all', tab: 'list' | 'recent' }
  };

  function loadQueuePrefs() {
    const base = { folder: 'all', filter: 'todo', tab: 'list' };
    try { return { ...base, ...JSON.parse(localStorage.getItem('roam-wa-queue') || '{}') }; } catch (e) { return base; }
  }
  function saveQueuePrefs() {
    try { localStorage.setItem('roam-wa-queue', JSON.stringify(ui.queue)); } catch (e) { /* ignore */ }
  }

  const LAST_FOLDER_KEY = 'roam-wa-last-folder';
  function rememberedFolderId() {
    try { const id = localStorage.getItem(LAST_FOLDER_KEY); return id && getFolder(id) ? id : ''; } catch (e) { return ''; }
  }
  function rememberFolderId(id) {
    try { localStorage.setItem(LAST_FOLDER_KEY, id || ''); } catch (e) { /* ignore */ }
  }

  function freshQS(templateId) {
    return {
      phone: '',
      templateId: templateId || defaultTemplateId(),
      fields: {},
      details: { name: '', country: '', website: '', instagram: '', email: '', notes: '' },
      contactId: null,
      folderId: rememberedFolderId(),
      isFollowUp: false,
      override: null, // manually edited message text
    };
  }

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const main = () => $('#view');

  // ---------------------------------------------------------------------------
  // Router
  // ---------------------------------------------------------------------------

  const VIEWS = { send: renderSend, followups: renderFollowUps, history: renderHistory, contacts: renderContacts, templates: renderTemplates, settings: renderSettings };

  function go(view) {
    if (location.hash !== '#' + view) location.hash = view;
    else render();
  }

  function render() {
    document.body.classList.toggle('signed-out', !ui.ready);
    if (!ui.ready) { if (ui.auth) renderAuth(); return; }
    const v = location.hash.replace('#', '');
    ui.view = VIEWS[v] ? v : 'send';
    $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === ui.view));
    VIEWS[ui.view]();
    updateNavBadge();
    main().focus({ preventScroll: true });
  }

  function updateNavBadge() {
    const n = dueFollowUps().length;
    const badge = $('#fu-badge');
    badge.textContent = n;
    badge.hidden = n === 0;
  }

  // ---------------------------------------------------------------------------
  // Quick Send
  // ---------------------------------------------------------------------------

  function templateOptions(selectedId, { includeInactive = false, placeholder } = {}) {
    const list = includeInactive ? db.templates : activeTemplates();
    const groups = {};
    list.forEach((t) => { (groups[t.category || 'Other'] = groups[t.category || 'Other'] || []).push(t); });
    let html = placeholder ? `<option value="">${esc(placeholder)}</option>` : '';
    for (const [cat, ts] of Object.entries(groups)) {
      html += `<optgroup label="${esc(cat)}">` +
        ts.map((t) => `<option value="${t.id}"${t.id === selectedId ? ' selected' : ''}>${esc(t.name)}${t.active ? '' : ' (inactive)'}</option>`).join('') +
        '</optgroup>';
    }
    return html;
  }

  function renderSend() {
    const qs = ui.qs;
    if (qs.templateId && !getTemplate(qs.templateId)) qs.templateId = defaultTemplateId();
    const followBanner = qs.isFollowUp && qs.contactId && getContact(qs.contactId)
      ? `<div class="banner">Follow-up for <strong>${esc(contactLabel(getContact(qs.contactId)))}</strong> — marking this as sent completes the follow-up. <button class="link" data-action="qs-clear">Cancel</button></div>`
      : '';

    main().innerHTML = `
      <div class="qs-top" id="qs-top"></div>
      <div class="qs">
        <div class="qs-left">
          ${followBanner}
          <section class="card qs-form" aria-label="Quick send">
            <div class="field">
              <label for="qs-phone">WhatsApp number</label>
              <input id="qs-phone" class="input-lg" type="tel" inputmode="tel" autocomplete="off" spellcheck="false"
                placeholder="+57 300 123 4567" value="${esc(qs.phone)}">
              <div class="hint" id="qs-phone-hint" aria-live="polite"></div>
            </div>
            <div class="field">
              <div class="label-row">
                <label for="qs-template">Template</label>
                <span id="qs-suggest"></span>
              </div>
              <select id="qs-template">${templateOptions(qs.templateId, { placeholder: activeTemplates().length ? null : 'No active templates' })}</select>
            </div>
            <div id="qs-vars" class="vars-grid"></div>
            <div class="field folder-field">
              <label for="qs-folder">Folder</label>
              <select id="qs-folder">${folderOptions(qs.folderId)}</select>
            </div>
            <details class="more" id="qs-details">
              <summary>Lead details <span class="muted">(optional)</span></summary>
              <div class="vars-grid">
                ${DETAIL_FIELDS.map(([k, label, ph]) => `
                  <div class="field">
                    <label for="qs-d-${k}">${label}</label>
                    <input id="qs-d-${k}" data-detail="${k}" value="${esc(qs.details[k])}" placeholder="${esc(ph)}" autocomplete="off">
                  </div>`).join('')}
                <div class="field span-2">
                  <label for="qs-d-notes">Notes</label>
                  <textarea id="qs-d-notes" data-detail="notes" rows="2" placeholder="Found on Instagram, 6 villas in Guatapé…">${esc(qs.details.notes)}</textarea>
                </div>
              </div>
              <div class="row-end">
                <button class="btn" data-action="save-lead">Save lead</button>
              </div>
            </details>
            <div class="form-foot">
              <button class="btn btn-ghost" data-action="qs-clear">Clear form</button>
              <span class="muted small">Every lead you type, paste or open is saved automatically.</span>
            </div>
          </section>

          <section class="card recents" aria-label="Leads">
            <div class="card-head">
              <div class="tabs" role="tablist" aria-label="Leads">
                <button role="tab" id="tab-list" data-action="leads-tab" data-tab="list">Lead list</button>
                <button role="tab" id="tab-recent" data-action="leads-tab" data-tab="recent">Recent</button>
              </div>
              <a href="#contacts" class="small">Manage leads →</a>
            </div>
            <div id="qs-recents"></div>
          </section>
        </div>

        <div class="qs-right">
          <section class="card preview-card" aria-label="Message preview">
            <div class="card-head">
              <h2>Message preview</h2>
              <span class="head-actions" id="qs-edit-actions"></span>
            </div>
            <div class="chat">
              <div id="qs-preview"></div>
            </div>
            <div class="preview-meta" id="qs-meta"></div>
            <button class="btn-wa" id="qs-open" data-action="open-wa">
              <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3Z"/></svg>
              <span>OPEN WHATSAPP →</span>
            </button>
            <div class="open-hint" id="qs-open-hint"></div>
          </section>
          <div id="qs-after" aria-live="polite"></div>
        </div>
      </div>`;

    renderVars();
    updatePhoneHint();
    updatePreview();
    renderAfter();
    renderRecents();

    const phone = $('#qs-phone');
    phone.addEventListener('input', () => {
      ui.qs.phone = phone.value;
      if (ui.qs.contactId) {
        const c = getContact(ui.qs.contactId);
        const n = L.normalizePhone(phone.value, db.settings.defaultCountryCode);
        if (!c || c.phone !== n.digits) {
          // A different number: drop the loaded lead's details so they don't end up on this one.
          ui.qs.contactId = null;
          ui.qs.isFollowUp = false;
          clearLeadFields();
        }
      }
      updatePhoneHint();
      updatePreview();
    });
    phone.addEventListener('blur', () => maybeAutofillKnown());

    $('#qs-template').addEventListener('change', (e) => selectTemplate(e.target.value));

    const folderSel = $('#qs-folder');
    folderSel.addEventListener('change', async () => {
      let id = folderSel.value;
      if (id === '__new') {
        const f = await newFolderModal();
        id = f ? f.id : ui.qs.folderId;
        folderSel.innerHTML = folderOptions(id);
        folderSel.focus();
      }
      ui.qs.folderId = id;
      rememberFolderId(id);
    });

    // Pasting a whole lead ("Casa Libia, +57 300 123 4567, Medellín") into the number box fills the form.
    phone.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (!text || L.looksLikePhone(text)) return;
      const parsed = L.parseLeads(text, db.settings.defaultCountryCode);
      if (parsed.leads.length > 1) { e.preventDefault(); pasteLeadsModal(text); return; }
      if (parsed.leads.length !== 1) return;
      e.preventDefault();
      const lead = parsed.leads[0];
      const known = contactByPhone(lead.phone);
      if (known) { fillFromContact(known); } else {
        ui.qs.phone = L.formatPhone(lead.phone);
        phone.value = ui.qs.phone;
        if (lead.propertyName) ui.qs.fields.property_name = lead.propertyName;
        if (lead.city) ui.qs.fields.city = lead.city;
        if (lead.notes) { ui.qs.details.notes = lead.notes; const n = $('#qs-d-notes'); if (n) n.value = lead.notes; }
        renderVars();
        const saved = autoSaveLead();
        if (saved) toast(`Saved ${contactLabel(saved)}${folderOf(saved) ? ' to ' + folderOf(saved).name : ''}`);
        updatePhoneHint();
        updatePreview();
        renderRecents();
      }
      const firstEmpty = $$('#qs-vars input').find((el) => !el.value);
      (firstEmpty || $('#qs-open')).focus();
    });

    $$('[data-detail]').forEach((el) => el.addEventListener('input', () => {
      ui.qs.details[el.dataset.detail] = el.value;
      if (el.dataset.detail === 'name') {
        const fn = $('#qs-v-first_name');
        const derived = L.firstName(el.value);
        if (fn && (!fn.value || fn.dataset.auto === '1')) {
          fn.value = derived; fn.dataset.auto = '1'; ui.qs.fields.first_name = derived;
        }
      }
      if (el.dataset.detail === 'country' && $('#qs-v-country')) {
        $('#qs-v-country').value = el.value; ui.qs.fields.country = el.value;
      }
      updatePreview();
    }));

    if (qs.contactId) $('#qs-open').focus(); else phone.focus();
  }

  /** Empty the personalization fields and lead details (keeps the number, template and folder picker). */
  function clearLeadFields() {
    const qs = ui.qs;
    qs.fields = {};
    qs.details = { name: '', country: '', website: '', instagram: '', email: '', notes: '' };
    qs.folderId = rememberedFolderId();
    qs.override = null;
    $$('[data-detail]').forEach((el) => { el.value = ''; });
    const folderSel = $('#qs-folder');
    if (folderSel) folderSel.innerHTML = folderOptions(qs.folderId);
    const banner = $('.qs .banner');
    if (banner) banner.remove();
    renderVars();
  }

  function selectTemplate(id) {
    ui.qs.templateId = id;
    ui.qs.override = null;
    if (id && !ui.qs.isFollowUp) { db.settings.lastTemplateId = id; save(); }
    const sel = $('#qs-template');
    if (sel && sel.value !== id) sel.value = id;
    renderVars();
    updatePreview();
  }

  function renderVars() {
    const t = getTemplate(ui.qs.templateId);
    const box = $('#qs-vars');
    if (!box) return;
    const vars = t ? L.extractVariables(t.body) : [];
    box.innerHTML = vars.map((k) => {
      const meta = KNOWN_VARS[k] || { label: k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), placeholder: '' };
      return `
        <div class="field">
          <label for="qs-v-${k}">${esc(meta.label)}</label>
          <input id="qs-v-${k}" data-var="${k}" value="${esc(ui.qs.fields[k] || '')}" placeholder="${esc(meta.placeholder)}"
            autocomplete="off" ${meta.list ? `list="${meta.list}"` : ''}>
        </div>`;
    }).join('');
    $$('[data-var]', box).forEach((el) => el.addEventListener('input', () => {
      ui.qs.fields[el.dataset.var] = el.value;
      delete el.dataset.auto;
      updatePreview();
    }));
  }

  function currentValues() {
    return { ...ui.qs.fields };
  }

  function currentMessage() {
    if (ui.qs.override != null) return ui.qs.override;
    const t = getTemplate(ui.qs.templateId);
    return t ? L.renderTemplate(t.body, currentValues()) : '';
  }

  function updatePhoneHint() {
    const hint = $('#qs-phone-hint');
    if (!hint) return;
    const n = L.normalizePhone(ui.qs.phone, db.settings.defaultCountryCode);
    const known = n.ok ? contactByPhone(n.digits) : null;
    let html = '';
    if (!ui.qs.phone.trim()) {
      html = db.settings.defaultCountryCode
        ? `Default country code +${esc(db.settings.defaultCountryCode)} is added to numbers without one.`
        : 'Include the country code, e.g. +57.';
    } else if (!n.ok) {
      html = `<span class="err">${esc(n.error)}</span>`;
    } else {
      html = `<span class="ok">✓ Opens chat with ${esc(L.formatPhone(n.digits))}</span>`;
      if (known && known.id !== ui.qs.contactId) {
        const last = known.lastSentAt || known.lastOpenedAt;
        html += `<div class="known">Known lead: <strong>${esc(contactLabel(known))}</strong>${known.propertyName && known.name ? ' · ' + esc(known.propertyName) : ''}` +
          `${last ? ' · last contacted ' + esc(fmtRelative(last).toLowerCase()) : ''} ` +
          `<button class="link" data-action="load-contact" data-id="${known.id}">Load details</button></div>`;
      } else if (known && known.id === ui.qs.contactId) {
        const st = contactStatus(known);
        html += ` <span class="pill pill-${st.key}">${esc(st.label)}</span>`;
      }
      if (known && known.noWhatsapp) html += `<div class="known">This number was marked as not on WhatsApp.</div>`;
    }
    hint.innerHTML = html;
  }

  /** If the typed number belongs to a saved lead and nothing has been typed yet, fill it in. */
  function maybeAutofillKnown() {
    const n = L.normalizePhone(ui.qs.phone, db.settings.defaultCountryCode);
    if (!n.ok || ui.qs.contactId) return;
    const known = contactByPhone(n.digits);
    const typedSomething = Object.values(ui.qs.fields).some((v) => v && v.trim()) ||
      Object.values(ui.qs.details).some((v) => v && v.trim());
    if (known && !typedSomething) fillFromContact(known);
  }

  function fillFromContact(c) {
    const qs = ui.qs;
    qs.contactId = c.id;
    qs.phone = L.formatPhone(c.phone);
    qs.fields = { ...(c.extra || {}) };
    for (const [k, meta] of Object.entries(KNOWN_VARS)) qs.fields[k] = meta.from(c) || '';
    qs.details = { name: c.name || '', country: c.country || '', website: c.website || '', instagram: c.instagram || '', email: c.email || '', notes: c.notes || '' };
    qs.folderId = folderOf(c) ? c.folderId : '';
    qs.override = null;
    const folderSel = $('#qs-folder');
    if (folderSel) folderSel.innerHTML = folderOptions(qs.folderId);
    const phone = $('#qs-phone');
    if (phone) phone.value = qs.phone;
    for (const [k, v] of Object.entries(qs.details)) { const el = $(`[data-detail="${k}"]`); if (el) el.value = v; }
    renderVars();
    updatePhoneHint();
    updatePreview();
  }

  function updatePreview() {
    const qs = ui.qs;
    const t = getTemplate(qs.templateId);
    const box = $('#qs-preview');
    if (!box) return;
    const values = currentValues();

    // Suggested template for the property type.
    const suggest = $('#qs-suggest');
    const cat = categoryForPropertyType(values.property_type) || categoryForPropertyType(values.property_name);
    const sugg = cat && (!t || t.category !== cat) && !qs.isFollowUp ? activeTemplates().find((x) => x.category === cat) : null;
    suggest.innerHTML = sugg ? `<button class="chip chip-suggest" data-action="use-template" data-id="${sugg.id}">Suggested: ${esc(sugg.name)}</button>` : '';

    const editActions = $('#qs-edit-actions');
    if (qs.override != null) {
      editActions.innerHTML = `<span class="pill pill-opened">Edited</span> <button class="link" data-action="reset-edit">Reset to template</button>`;
      if (!$('#qs-override')) {
        box.innerHTML = `<textarea id="qs-override" class="bubble bubble-edit" aria-label="Edit message">${esc(qs.override)}</textarea>`;
        const ta = $('#qs-override');
        autoGrow(ta);
        ta.addEventListener('input', () => { qs.override = ta.value; autoGrow(ta); updateMeta(); });
      }
    } else {
      editActions.innerHTML = t ? `<button class="link" data-action="edit-message">Edit message</button>` : '';
      if (!t) {
        box.innerHTML = `<div class="empty">Pick a template to see the message.</div>`;
      } else {
        box.innerHTML = `<div class="bubble">${L.templateSegments(t.body, values).map((s) =>
          s.type === 'text' ? esc(s.text)
            : s.type === 'var' ? `<mark class="v-ok" title="{{${esc(s.key)}}}">${esc(s.text)}</mark>`
              : `<mark class="v-missing" title="Fill in ${esc(s.key)}">${esc(s.text)}</mark>`).join('')}</div>`;
      }
    }
    updateMeta();
  }

  function updateMeta() {
    const qs = ui.qs;
    const t = getTemplate(qs.templateId);
    const msg = currentMessage();
    const n = L.normalizePhone(qs.phone, db.settings.defaultCountryCode);
    const missing = qs.override != null ? L.extractVariables(qs.override) : (t ? L.missingVariables(t.body, currentValues()) : []);
    const btn = $('#qs-open');
    const hint = $('#qs-open-hint');
    const meta = $('#qs-meta');
    meta.textContent = msg ? `${msg.length} characters` : '';

    let problem = '';
    if (!n.ok) problem = qs.phone.trim() ? 'Fix the WhatsApp number to continue.' : 'Enter a WhatsApp number to continue.';
    else if (!msg.trim()) problem = 'Pick a template to continue.';
    else if (missing.length) problem = 'Fill in: ' + missing.map((k) => (KNOWN_VARS[k] ? KNOWN_VARS[k].label : k)).join(', ');
    btn.disabled = !!problem;
    hint.innerHTML = problem ? esc(problem) : `Opens ${esc(modeLabel())} with the message ready — you press Send. <kbd>${modKey}</kbd>+<kbd>Enter</kbd>`;
  }

  function autoGrow(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight + 2, 560) + 'px';
  }

  function resolveMode() {
    const m = db.settings.openMode;
    if (m && m !== 'auto') return m;
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    return mobile ? 'wa' : 'web';
  }

  function modeLabel() {
    return { web: 'WhatsApp Web', app: 'the WhatsApp app', wa: 'WhatsApp' }[resolveMode()];
  }

  function openUrl(url, mode) {
    if (mode === 'app') { window.location.href = url; return; }
    // Reuse one WhatsApp Web tab so it doesn't complain about being open in several windows.
    const win = window.open(url, mode === 'web' ? 'roam-whatsapp-web' : '_blank');
    if (!win) {
      toast('Your browser blocked the popup — allow popups for this page, or use the link below.', 'warn', url);
    } else {
      try { win.focus(); } catch (e) { /* cross-origin */ }
    }
  }

  function upsertContact(digits, patch) {
    let c = contactByPhone(digits);
    if (!c) {
      c = { id: uid(), phone: digits, name: '', propertyName: '', country: '', city: '', propertyType: '', website: '', instagram: '', email: '', notes: '', extra: {}, createdAt: nowIso(), lastOpenedAt: null, lastSentAt: null, followUp: null };
      db.contacts.unshift(c);
    }
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'extra') c.extra = { ...(c.extra || {}), ...v };
      else if (v != null && String(v).trim() !== '') c[k] = typeof v === 'string' ? v.trim() : v;
    }
    return c;
  }

  function contactPatchFromQS() {
    const f = ui.qs.fields;
    const d = ui.qs.details;
    const extra = {};
    for (const [k, v] of Object.entries(f)) if (!KNOWN_VARS[k] && v && v.trim()) extra[k] = v.trim();
    let name = d.name && d.name.trim();
    if (!name && f.first_name && f.first_name.trim()) {
      const existing = ui.qs.contactId && getContact(ui.qs.contactId);
      // Keep an existing full name if the first name still matches it.
      name = existing && L.firstName(existing.name) === f.first_name.trim() ? existing.name : f.first_name.trim();
    }
    return {
      name,
      propertyName: f.property_name,
      city: f.city,
      propertyType: f.property_type,
      country: d.country || f.country,
      website: d.website,
      instagram: d.instagram,
      email: d.email,
      notes: d.notes,
      extra,
    };
  }

  /** Put the lead in the folder picked in Quick Send. An existing lead that wasn't loaded keeps its folder unless one is picked. */
  function applyQSFolder(c) {
    const picked = getFolder(ui.qs.folderId) ? ui.qs.folderId : null;
    if (picked || ui.qs.contactId === c.id || !c.folderId) c.folderId = picked;
  }

  function openWhatsApp() {
    const qs = ui.qs;
    const btn = $('#qs-open');
    if (!btn || btn.disabled) return;
    const n = L.normalizePhone(qs.phone, db.settings.defaultCountryCode);
    const msg = currentMessage();
    const mode = resolveMode();
    openUrl(L.buildWhatsAppUrl(n.digits, msg, mode), mode);

    const c = upsertContact(n.digits, { ...contactPatchFromQS(), lastOpenedAt: nowIso() });
    applyQSFolder(c);
    const t = getTemplate(qs.templateId);
    const o = {
      id: uid(),
      contactId: c.id,
      phone: n.digits,
      contactName: c.name,
      propertyName: c.propertyName,
      templateId: t ? t.id : null,
      templateName: t ? t.name : 'Custom message',
      message: msg,
      status: 'sent', // opening the chat counts as sent; "Not on WhatsApp" reverses it
      openedAt: nowIso(),
      sentAt: nowIso(),
      isFollowUp: !!qs.isFollowUp,
    };
    db.outreach.unshift(o);
    c.lastSentAt = o.sentAt;
    c.noWhatsapp = false;
    if (o.isFollowUp || c.followUp) c.followUp = null; // sending anything clears a pending follow-up
    save();
    qs.contactId = c.id;
    qs.isFollowUp = false;
    ui.pending = { outreachId: o.id, stage: 'followup' };
    const banner = $('.qs .banner');
    if (banner) banner.remove();
    updatePhoneHint();
    renderAfter();
    renderRecents();
    updateNavBadge();
  }

  /** Latest time a message to this lead counted as sent, or null. */
  function lastSentFor(contactId) {
    return db.outreach
      .filter((o) => o.contactId === contactId && o.status === 'sent' && o.sentAt)
      .reduce((max, o) => (!max || o.sentAt > max ? o.sentAt : max), null);
  }

  /** The number isn't on WhatsApp: the message no longer counts as sent and the lead is tagged. */
  function markNoWhatsapp(ids) {
    const before = [];
    for (const id of ids) {
      const o = getOutreach(id);
      if (!o || o.status === 'no_whatsapp') continue;
      const c = getContact(o.contactId);
      before.push({ o, status: o.status, sentAt: o.sentAt, c, c0: c && { lastSentAt: c.lastSentAt, noWhatsapp: c.noWhatsapp, followUp: c.followUp } });
      o.status = 'no_whatsapp';
      o.sentAt = null;
      if (c) { c.noWhatsapp = true; c.lastSentAt = lastSentFor(c.id); c.followUp = null; }
    }
    if (!before.length) return;
    save();
    refreshView();
    const one = before.length === 1 && before[0].c;
    toastUndo(one ? `${contactLabel(one)} marked as not on WhatsApp` : `${plural(before.length, 'entry', 'entries')} marked as not on WhatsApp`, () => {
      for (const b of before) {
        b.o.status = b.status; b.o.sentAt = b.sentAt;
        if (b.c) Object.assign(b.c, b.c0);
      }
      if (ui.pending && before.some((b) => b.o.id === ui.pending.outreachId)) ui.pending.stage = 'followup';
      save();
      refreshView();
      if (ui.view === 'send') renderAfter();
    });
  }

  function markSent(outreachId) {
    const o = getOutreach(outreachId);
    if (!o || o.status === 'sent') return;
    o.status = 'sent';
    o.sentAt = nowIso();
    const c = getContact(o.contactId);
    if (c) {
      c.lastSentAt = o.sentAt;
      c.noWhatsapp = false;
      if (o.isFollowUp || c.followUp) c.followUp = null; // Sending anything clears a pending follow-up.
    }
    save();
    if (ui.pending && ui.pending.outreachId === outreachId) ui.pending.stage = 'followup';
    if (ui.qs.contactId === o.contactId) ui.qs.isFollowUp = false;
    updateNavBadge();
    toast(`Marked as sent${c ? ' — ' + contactLabel(c) : ''}`);
  }

  function refreshSendAfterSent() {
    const banner = $('.qs .banner');
    if (banner && !ui.qs.isFollowUp) banner.remove();
    updatePhoneHint();
    updatePreview();
    renderRecents();
    renderAfter();
    const first = $('#qs-after .chip');
    if (first) first.focus();
  }

  function schedulerHtml(contactId, { compact = false } = {}) {
    const c = getContact(contactId);
    const tplId = (c && c.followUp && c.followUp.templateId) || defaultFollowUpTemplateId();
    return `
      <div class="sched" data-contact="${contactId}">
        <div class="sched-row">
          <button class="chip" data-action="fu-days" data-days="3">3 days</button>
          <button class="chip" data-action="fu-days" data-days="5">5 days</button>
          <button class="chip" data-action="fu-days" data-days="7">7 days</button>
          <span class="sched-custom">
            <input type="date" class="fu-date" aria-label="Custom follow-up date" min="${L.localDate(new Date())}">
            <button class="chip" data-action="fu-date">Set date</button>
          </span>
        </div>
        <label class="sched-tpl ${compact ? 'small' : ''}">Follow-up template
          <select class="fu-template">${templateOptions(tplId)}</select>
        </label>
      </div>`;
  }

  function renderAfter() {
    const box = $('#qs-after');
    if (!box) return;
    const p = ui.pending;
    const o = p && getOutreach(p.outreachId);
    if (!o) { box.innerHTML = ''; return; }
    const c = getContact(o.contactId);
    const who = esc(c ? contactLabel(c) : L.formatPhone(o.phone));

    if (p.stage === 'confirm' && o.status !== 'sent') {
      box.innerHTML = `
        <section class="card after">
          <div class="after-title"><span class="dot dot-opened"></span> WhatsApp opened for <strong>${who}</strong></div>
          <p class="muted small">Opening a chat isn’t sending. Once you’ve pressed Send in WhatsApp, record it here.</p>
          <div class="row">
            <button class="btn btn-primary" data-action="mark-sent" data-id="${o.id}" title="Alt+S">✓ Mark as Sent</button>
            <button class="btn" data-action="reopen" data-id="${o.id}">Open again</button>
            <button class="btn btn-ghost" data-action="dismiss-after">Not sent</button>
          </div>
        </section>`;
    } else if (o.status === 'no_whatsapp') {
      box.innerHTML = `
        <section class="card after">
          <div class="after-title"><span class="dot dot-nowa"></span> <strong>${who}</strong> is marked as not on WhatsApp. It isn’t counted as sent.</div>
          <div class="row">
            <button class="btn btn-primary" data-action="qs-next" title="Alt+N">Next lead →</button>
            <button class="btn btn-ghost" data-action="mark-sent" data-id="${o.id}">It is on WhatsApp — count as sent</button>
          </div>
        </section>`;
      const next = $('[data-action="qs-next"]', box);
      if (next) next.focus();
    } else if (p.stage === 'followup' || (p.stage === 'confirm' && o.status === 'sent')) {
      box.innerHTML = `
        <section class="card after">
          <div class="after-title"><span class="dot dot-sent"></span> Counted as sent to <strong>${who}</strong>. Schedule a follow-up?</div>
          <p class="muted small nowa-hint">Number not on WhatsApp? <button class="btn btn-sm btn-nowa" data-action="no-whatsapp" data-id="${o.id}" title="Alt+X">Not on WhatsApp</button></p>
          ${schedulerHtml(o.contactId)}
          <div class="row">
            <button class="btn btn-ghost" data-action="fu-skip">No follow-up</button>
            <button class="btn" data-action="qs-next" title="Alt+N">Next lead →</button>
          </div>
        </section>`;
    } else {
      const due = c && c.followUp ? `Follow-up scheduled ${esc(fmtDue(c.followUp.due))}.` : 'No follow-up scheduled.';
      box.innerHTML = `
        <section class="card after">
          <div class="after-title"><span class="dot dot-sent"></span> Done with <strong>${who}</strong>. ${due}</div>
          <div class="row"><button class="btn btn-primary" data-action="qs-next" title="Alt+N">Next lead →</button></div>
        </section>`;
      const next = $('[data-action="qs-next"]', box);
      if (next) next.focus();
    }
  }

  /** Everything on Quick Send that depends on the lead data: counter, list bar, lead list. */
  function renderRecents() {
    renderTopBar();
    renderLeadsPanel();
  }

  // ---- Sent counter ----

  function sentSinceReset() {
    const since = db.settings.counterResetAt || '';
    return db.outreach.filter((o) => o.status === 'sent' && o.sentAt && (!since || new Date(o.sentAt) > new Date(since))).length;
  }

  function sentToday() {
    const today = L.localDate(new Date());
    return db.outreach.filter((o) => o.status === 'sent' && o.sentAt && L.localDate(o.sentAt) === today).length;
  }

  // ---- Lead list (queue) ----

  const queueFolderName = () => (ui.queue.folder === 'all' ? 'All leads' : ui.queue.folder === 'none' ? 'No folder' : (getFolder(ui.queue.folder) || {}).name || 'All leads');

  /** Leads in the chosen folder, oldest first (the order they were added or pasted). */
  function queueOrdered() {
    if (ui.queue.folder !== 'all' && ui.queue.folder !== 'none' && !getFolder(ui.queue.folder)) ui.queue.folder = 'all';
    return db.contacts
      .filter((c) => ui.queue.folder === 'all' || (ui.queue.folder === 'none' ? !folderOf(c) : c.folderId === ui.queue.folder))
      .slice()
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id));
  }

  const queueMatches = (c) => ui.queue.filter === 'all' || (!c.lastSentAt && !c.noWhatsapp);

  /** What the list shows: matching leads, plus the loaded lead so it stays visible after sending. */
  function queueItems() {
    return queueOrdered().filter((c) => queueMatches(c) || c.id === ui.qs.contactId);
  }

  /** The next (dir 1) or previous (dir -1) lead to contact, relative to the loaded one. */
  function queueStep(dir) {
    const list = queueOrdered();
    const i = list.findIndex((c) => c.id === ui.qs.contactId);
    const start = i < 0 ? (dir > 0 ? -1 : list.length) : i;
    for (let j = start + dir; j >= 0 && j < list.length; j += dir) {
      if (queueMatches(list[j]) && list[j].id !== ui.qs.contactId) return list[j];
    }
    return null;
  }

  function goQueue(dir) {
    autoSaveLead();
    const c = queueStep(dir);
    if (c) { loadContact(c.id); return; }
    if (dir > 0) {
      clearQuickSend();
      toast(`No more leads to contact in ${queueFolderName()}. The form is clear for a new number.`);
    } else {
      toast('This is the first lead in the list.');
    }
  }

  /** Save what's typed in Quick Send as a lead (new or loaded), so moving on never loses it. */
  function autoSaveLead() {
    const qs = ui.qs;
    const n = L.normalizePhone(qs.phone, db.settings.defaultCountryCode);
    if (!n.ok) return null;
    const f = qs.fields;
    const typed = qs.contactId || [f.property_name, f.city, qs.details.name, qs.details.notes].some((v) => v && v.trim());
    if (!typed) return null;
    const c = upsertContact(n.digits, contactPatchFromQS());
    applyQSFolder(c);
    qs.contactId = c.id;
    save();
    return c;
  }

  function renderTopBar() {
    const bar = $('#qs-top');
    if (!bar) return;
    const total = sentSinceReset();
    const today = sentToday();
    const since = db.settings.counterResetAt;
    const items = queueItems();
    const pos = items.findIndex((c) => c.id === ui.qs.contactId);
    const left = queueOrdered().filter((c) => !c.lastSentAt && !c.noWhatsapp).length;
    bar.innerHTML = `
      <div class="counter" role="group" aria-label="Messages sent">
        <span class="counter-num" id="sent-count">${total}</span>
        <span class="counter-label">sent<span class="muted small">${since ? 'since ' + esc(fmtDateTime(since)) : 'in total'} · ${today} today</span></span>
        <button class="btn btn-sm btn-ghost" data-action="counter-reset" title="Start counting from zero. History is kept.">Reset</button>
      </div>
      <div class="queue-nav" role="group" aria-label="Lead list">
        <select id="queue-folder" aria-label="Lead list folder">
          <option value="all">All leads</option>
          ${sortedFolders().map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}
          <option value="none">No folder</option>
        </select>
        <select id="queue-filter" aria-label="Which leads to go through">
          <option value="todo">Not sent yet</option>
          <option value="all">All leads</option>
        </select>
        <span class="queue-pos">${pos >= 0 ? `Lead ${pos + 1} of ${items.length}` : `${left} to contact`}</span>
        <button class="btn btn-sm" data-action="qs-prev" title="Alt+P">← Previous</button>
        <button class="btn btn-sm btn-primary" data-action="qs-next" title="Alt+N">Next lead →</button>
      </div>`;
    const fs = $('#queue-folder', bar);
    fs.value = ui.queue.folder;
    fs.addEventListener('change', () => { ui.queue.folder = fs.value; saveQueuePrefs(); renderRecents(); });
    const ff = $('#queue-filter', bar);
    ff.value = ui.queue.filter;
    ff.addEventListener('change', () => { ui.queue.filter = ff.value; saveQueuePrefs(); renderRecents(); });
  }

  function renderLeadsPanel() {
    const box = $('#qs-recents');
    if (!box) return;
    const tab = ui.queue.tab === 'recent' ? 'recent' : 'list';
    $$('[data-action="leads-tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    const list = tab === 'list' ? queueItems() : db.contacts
      .filter((c) => c.lastOpenedAt || c.lastSentAt)
      .sort((a, b) => (b.lastOpenedAt || b.lastSentAt || '').localeCompare(a.lastOpenedAt || a.lastSentAt || ''))
      .slice(0, 12);
    if (!list.length) {
      box.innerHTML = `<div class="empty small">${tab === 'recent' ? 'Leads you message will show up here.'
        : db.contacts.length ? `Every lead in ${esc(queueFolderName())} has been messaged. Pick another folder, or show all leads.`
          : 'No leads yet. Paste a list in Contacts → Paste leads, or type a number above.'}</div>`;
      return;
    }
    box.innerHTML = `<ul class="recent-list ${tab === 'list' ? 'lead-queue' : ''}">${list.map((c) => {
      const st = contactStatus(c);
      const current = c.id === ui.qs.contactId;
      return `<li><button class="recent ${current ? 'current' : ''}" data-action="queue-load" data-id="${c.id}" ${current ? 'aria-current="true"' : ''}>
        <span class="recent-main"><strong>${esc(c.propertyName || c.name || '—')}</strong><span class="muted">${esc([c.propertyName ? c.name : '', c.city, tab === 'recent' || ui.queue.folder === 'all' ? folderOf(c) && folderOf(c).name : ''].filter(Boolean).join(' · '))}</span></span>
        <span class="recent-phone mono">${esc(L.formatPhone(c.phone))}</span>
        <span class="recent-date"><span class="pill pill-${st.key}">${esc(st.label)}</span>${c.lastSentAt || c.lastOpenedAt ? `<span class="muted small">${esc(fmtRelative(c.lastSentAt || c.lastOpenedAt))}</span>` : ''}</span>
      </button></li>`;
    }).join('')}</ul>`;
    const cur = $('.recent.current', box);
    if (cur && tab === 'list') cur.scrollIntoView({ block: 'nearest' });
  }

  function loadContact(id, { followUp = false } = {}) {
    const c = getContact(id);
    if (!c) return;
    const tplId = followUp && c.followUp && getTemplate(c.followUp.templateId) ? c.followUp.templateId
      : followUp ? defaultFollowUpTemplateId()
        : (getTemplate(ui.qs.templateId) ? ui.qs.templateId : defaultTemplateId());
    ui.qs = freshQS(tplId);
    ui.qs.isFollowUp = followUp;
    ui.pending = null;
    if (ui.view !== 'send') {
      fillFromContactSilently(c);
      go('send');
    } else {
      fillFromContact(c);
      renderSend();
    }
  }

  function fillFromContactSilently(c) {
    const qs = ui.qs;
    qs.contactId = c.id;
    qs.phone = L.formatPhone(c.phone);
    qs.fields = { ...(c.extra || {}) };
    for (const [k, meta] of Object.entries(KNOWN_VARS)) qs.fields[k] = meta.from(c) || '';
    qs.details = { name: c.name || '', country: c.country || '', website: c.website || '', instagram: c.instagram || '', email: c.email || '', notes: c.notes || '' };
    qs.folderId = folderOf(c) ? c.folderId : '';
  }

  function clearQuickSend() {
    const keepTpl = ui.qs.isFollowUp ? defaultTemplateId() : ui.qs.templateId;
    ui.qs = freshQS(keepTpl);
    ui.pending = null;
    if (ui.view === 'send') renderSend(); else go('send');
  }

  function saveLeadFromQS() {
    const n = L.normalizePhone(ui.qs.phone, db.settings.defaultCountryCode);
    if (!n.ok) { toast('Enter a valid WhatsApp number to save the lead.', 'warn'); $('#qs-phone').focus(); return; }
    const c = upsertContact(n.digits, contactPatchFromQS());
    applyQSFolder(c);
    ui.qs.contactId = c.id;
    save();
    updatePhoneHint();
    renderRecents();
    toast(`Saved ${contactLabel(c)}`);
  }

  // ---------------------------------------------------------------------------
  // Follow-ups
  // ---------------------------------------------------------------------------

  function scheduleFollowUp(contactId, due, templateId) {
    const c = getContact(contactId);
    if (!c) return;
    c.followUp = { due, templateId: templateId || defaultFollowUpTemplateId(), createdAt: nowIso() };
    save();
    updateNavBadge();
    toast(`Follow-up with ${contactLabel(c)} ${fmtDue(due)}`);
  }

  function renderFollowUps() {
    const list = db.contacts.filter((c) => c.followUp).sort((a, b) => a.followUp.due.localeCompare(b.followUp.due));
    const groups = [
      ['Overdue', list.filter((c) => L.daysUntil(c.followUp.due) < 0)],
      ['Due today', list.filter((c) => L.daysUntil(c.followUp.due) === 0)],
      ['Upcoming', list.filter((c) => L.daysUntil(c.followUp.due) > 0)],
    ];
    const row = (c) => {
      const t = getTemplate(c.followUp.templateId);
      const d = L.daysUntil(c.followUp.due);
      return `<li class="fu-item ${d < 0 ? 'overdue' : d === 0 ? 'today' : ''}">
        <button class="fu-load" data-action="load-followup" data-id="${c.id}">
          <span class="fu-main"><strong>${esc(c.propertyName || c.name || '—')}</strong> <span class="muted">${esc([c.propertyName ? c.name : '', c.city].filter(Boolean).join(' · '))}</span></span>
          <span class="mono small">${esc(L.formatPhone(c.phone))}</span>
          <span class="small">${esc(t ? t.name : 'Template missing')}</span>
          <span class="fu-due">${esc(fmtDue(c.followUp.due))}</span>
        </button>
        <span class="fu-actions">
          <button class="btn btn-sm btn-primary" data-action="load-followup" data-id="${c.id}">Load →</button>
          <button class="btn btn-sm" data-action="reschedule" data-id="${c.id}">Reschedule</button>
          <button class="btn btn-sm btn-ghost" data-action="fu-cancel" data-id="${c.id}" title="Remove follow-up">Done</button>
        </span>
      </li>`;
    };
    main().innerHTML = `
      <div class="page">
        <div class="page-head">
          <h1>Follow-ups</h1>
          <p class="muted">Select a lead to load it into Quick Send with its follow-up template.</p>
        </div>
        ${list.length ? groups.filter(([, items]) => items.length).map(([title, items]) => `
          <section class="card">
            <div class="card-head"><h2>${title} <span class="count">${items.length}</span></h2></div>
            <ul class="fu-list">${items.map(row).join('')}</ul>
          </section>`).join('')
        : `<section class="card empty-state"><h2>No follow-ups scheduled</h2><p class="muted">After you mark a message as sent, pick 3, 5 or 7 days (or a date) and it will appear here when it’s due.</p><a class="btn btn-primary" href="#send">Go to Quick Send</a></section>`}
      </div>`;
  }

  // ---------------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------------

  function renderHistory() {
    const counts = { all: db.outreach.length };
    for (const o of db.outreach) counts[o.status] = (counts[o.status] || 0) + 1;
    const filters = [['all', 'All'], ['sent', 'Sent'], ['no_whatsapp', 'Not on WhatsApp']].concat(counts.opened ? [['opened', 'Opened']] : []);
    if (!filters.some(([f]) => f === ui.historyFilter)) ui.historyFilter = 'all';
    main().innerHTML = `
      <div class="page">
        <div class="page-head">
          <h1>Outreach history</h1>
          <p class="muted">Opening WhatsApp counts as sent. Mark numbers that aren’t on WhatsApp so they don’t count.</p>
        </div>
        <div class="toolbar">
          <div class="seg" role="group" aria-label="Filter by status">
            ${filters.map(([f, label]) => `<button class="${ui.historyFilter === f ? 'on' : ''}" data-action="history-filter" data-f="${f}">${label} <span class="count">${counts[f] || 0}</span></button>`).join('')}
          </div>
          <input id="history-search" type="search" placeholder="Search name, property, number…" value="${esc(ui.historySearch)}">
        </div>
        <div id="history-bulk"></div>
        <section class="card flush"><div id="history-body"></div></section>
      </div>`;
    const s = $('#history-search');
    s.addEventListener('input', () => { ui.historySearch = s.value; renderHistoryBody(); });
    $('#history-body').addEventListener('change', (e) => {
      const box = e.target.closest('input[type="checkbox"]');
      if (!box) return;
      if (box.id === 'history-select-all') {
        historyRows().forEach((o) => (box.checked ? ui.historySelected.add(o.id) : ui.historySelected.delete(o.id)));
      } else if (box.dataset.hselect) {
        if (box.checked) ui.historySelected.add(box.dataset.hselect); else ui.historySelected.delete(box.dataset.hselect);
      }
      renderHistoryBody();
    });
    renderHistoryBody();
  }

  function historyRows() {
    const q = ui.historySearch.trim().toLowerCase();
    return db.outreach.filter((o) => {
      if (ui.historyFilter !== 'all' && o.status !== ui.historyFilter) return false;
      if (!q) return true;
      const c = getContact(o.contactId) || {};
      return [c.name || o.contactName, c.propertyName || o.propertyName, o.phone, o.templateName, o.message].join(' ').toLowerCase().includes(q);
    });
  }

  function renderHistoryBulk(rows) {
    const bar = $('#history-bulk');
    if (!bar) return;
    const sel = [...ui.historySelected].map(getOutreach).filter(Boolean);
    if (!sel.length) {
      bar.innerHTML = rows.length ? '<div class="bulk bulk-idle"><span>Tick entries to delete or mark several at once.</span></div>' : '';
      return;
    }
    const opened = sel.filter((o) => o.status !== 'sent').length;
    const canNowa = sel.filter((o) => o.status !== 'no_whatsapp').length;
    bar.innerHTML = `
      <div class="bulk">
        <strong>${sel.length} selected</strong>
        ${opened ? `<button class="btn btn-sm" data-action="history-bulk-sent">Count ${opened} as sent</button>` : ''}
        ${canNowa ? `<button class="btn btn-sm btn-nowa" data-action="history-bulk-nowa">Not on WhatsApp (${canNowa})</button>` : ''}
        <button class="btn btn-sm btn-danger" data-action="history-bulk-delete">Delete ${plural(sel.length, 'entry', 'entries')}</button>
        <button class="btn btn-sm btn-ghost" data-action="history-bulk-clear">Clear selection</button>
      </div>`;
  }

  function renderHistoryBody() {
    const body = $('#history-body');
    if (!body) return;
    for (const id of ui.historySelected) if (!getOutreach(id)) ui.historySelected.delete(id);
    const rows = historyRows();
    renderHistoryBulk(rows);
    if (!rows.length) {
      body.innerHTML = `<div class="empty">${db.outreach.length ? 'Nothing matches.' : 'No outreach yet. Every time you open WhatsApp from Quick Send it’s logged here.'}</div>`;
      return;
    }
    body.innerHTML = `
      <div class="table-wrap"><table class="table">
        <thead><tr><th class="check"><input type="checkbox" id="history-select-all" aria-label="Select all entries shown"
          ${rows.every((o) => ui.historySelected.has(o.id)) ? 'checked' : ''}></th><th>Date</th><th>Contact</th><th>Number</th><th>Template</th><th>Status</th><th class="right">Actions</th></tr></thead>
        <tbody>${rows.map((o) => {
          const c = getContact(o.contactId);
          const person = (c && c.name) || o.contactName || '';
          const prop = (c && c.propertyName) || o.propertyName || '';
          const name = prop || person || '—';
          const sub = prop ? [person, c && c.city].filter(Boolean).join(' · ') : '';
          const picked = ui.historySelected.has(o.id);
          return `<tr class="${picked ? 'is-selected' : ''}">
            <td class="check"><input type="checkbox" data-hselect="${o.id}" ${picked ? 'checked' : ''} aria-label="Select entry for ${esc(name)}"></td>
            <td class="nowrap">${esc(fmtDateTime(o.openedAt))}</td>
            <td><strong>${esc(name)}</strong>${sub ? `<div class="muted small">${esc(sub)}</div>` : ''}</td>
            <td class="mono nowrap">${esc(L.formatPhone(o.phone))}</td>
            <td>${esc(o.templateName)}${o.isFollowUp ? ' <span class="pill pill-scheduled">follow-up</span>' : ''}
              <details class="msg"><summary>Message</summary><div class="bubble bubble-sm">${esc(o.message)}</div></details></td>
            <td>${o.status === 'sent'
              ? `<span class="pill pill-sent">Sent</span>`
              : o.status === 'no_whatsapp' ? '<span class="pill pill-nowa">Not on WhatsApp</span>' : '<span class="pill pill-opened">Opened</span>'}</td>
            <td class="right nowrap">
              ${o.status !== 'sent' ? `<button class="btn btn-sm" data-action="mark-sent" data-id="${o.id}">Count as sent</button>` : ''}
              ${o.status !== 'no_whatsapp' ? `<button class="btn btn-sm btn-nowa" data-action="no-whatsapp" data-id="${o.id}">Not on WhatsApp</button>` : ''}
              ${c ? `<button class="btn btn-sm" data-action="reschedule" data-id="${c.id}">${c.followUp ? 'Follow-up ' + esc(fmtDue(c.followUp.due)) : 'Follow-up…'}</button>` : ''}
              ${c ? `<button class="btn btn-sm btn-ghost" data-action="load-contact" data-id="${c.id}">Load</button>` : ''}
              <button class="btn btn-sm btn-ghost danger" data-action="delete-outreach" data-id="${o.id}" aria-label="Delete entry">✕</button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>`;
  }

  // ---------------------------------------------------------------------------
  // Contacts
  // ---------------------------------------------------------------------------

  function folderCounts() {
    const counts = { all: db.contacts.length, none: 0 };
    for (const c of db.contacts) {
      const f = folderOf(c);
      if (f) counts[f.id] = (counts[f.id] || 0) + 1; else counts.none++;
    }
    return counts;
  }

  function contactsInView() {
    const q = ui.contactSearch.trim().toLowerCase();
    return db.contacts
      .filter((c) => ui.folder === 'all' || (ui.folder === 'none' ? !folderOf(c) : c.folderId === ui.folder))
      .filter((c) => !q || CONTACT_FIELDS.map(([k]) => c[k]).concat(folderOf(c) ? folderOf(c).name : '').join(' ').toLowerCase().includes(q))
      .sort((a, b) => (b.lastOpenedAt || b.createdAt || '').localeCompare(a.lastOpenedAt || a.createdAt || ''));
  }

  function renderContacts() {
    if (ui.folder !== 'all' && ui.folder !== 'none' && !getFolder(ui.folder)) ui.folder = 'all';
    main().innerHTML = `
      <div class="page">
        <div class="page-head">
          <h1>Contacts</h1>
          <p class="muted">Sort leads into folders, paste lists straight from a spreadsheet, and message any lead in one click.</p>
        </div>
        <div class="contacts-layout">
          <aside class="card flush folders-card" aria-label="Folders">
            <div class="card-head pad"><h2>Folders</h2><button class="btn btn-sm" data-action="folder-new">+ New</button></div>
            <ul class="folder-list" id="folder-list"></ul>
          </aside>
          <div class="contacts-main">
            <div class="folder-head" id="folder-head"></div>
            <div class="toolbar">
              <input id="contact-search" type="search" placeholder="Search leads…" value="${esc(ui.contactSearch)}">
              <span class="spacer"></span>
              <button class="btn btn-primary" data-action="paste-leads">Paste leads</button>
              <button class="btn" data-action="import-csv">Import CSV</button>
              <button class="btn" data-action="export-csv">Export CSV</button>
              <button class="btn" data-action="edit-contact">+ Add lead</button>
            </div>
            <div id="bulk-bar"></div>
            <section class="card flush"><div id="contacts-body"></div></section>
          </div>
        </div>
      </div>`;
    const s = $('#contact-search');
    s.addEventListener('input', () => { ui.contactSearch = s.value; renderContactsBody(); });
    const body = $('#contacts-body');
    body.addEventListener('change', (e) => {
      const box = e.target.closest('input[type="checkbox"]');
      if (!box) return;
      if (box.id === 'select-all') {
        const ids = contactsInView().map((c) => c.id);
        ids.forEach((id) => (box.checked ? ui.selected.add(id) : ui.selected.delete(id)));
        $$('input[data-select]', body).forEach((el) => { el.checked = box.checked; });
      } else if (box.dataset.select) {
        if (box.checked) ui.selected.add(box.dataset.select); else ui.selected.delete(box.dataset.select);
        syncSelectAll();
      }
      renderBulkBar();
    });
    renderContactsBody();
  }

  /** Re-render everything on the Contacts page that depends on the data. */
  function renderContactsBody() {
    if (ui.view !== 'contacts' || !$('#contacts-body')) return;
    for (const id of ui.selected) if (!getContact(id)) ui.selected.delete(id);
    renderFolderList();
    renderFolderHead();
    renderBulkBar();
    const rows = contactsInView();
    const body = $('#contacts-body');
    if (!rows.length) {
      body.innerHTML = `<div class="empty">${ui.contactSearch.trim() ? 'No leads match your search.'
        : !db.contacts.length ? 'No leads yet. Paste a list from a spreadsheet, import a CSV, or just open WhatsApp from Quick Send.'
          : ui.folder === 'none' ? 'Every lead is in a folder.'
            : 'This folder is empty. Paste leads into it, or select leads in another folder and move them here.'}</div>`;
      return;
    }
    const showFolder = ui.folder === 'all';
    const showContact = rows.some((c) => c.name || c.notes); // you may only track properties
    body.innerHTML = `
      <div class="table-wrap"><table class="table">
        <thead><tr>
          <th class="check"><input type="checkbox" id="select-all" aria-label="Select all leads shown"></th>
          <th>Property</th>${showContact ? '<th>Contact</th>' : ''}<th>Number</th><th>Location</th>${showFolder ? '<th>Folder</th>' : ''}<th>Last contacted</th><th>Status</th><th class="right">Actions</th>
        </tr></thead>
        <tbody>${rows.map((c) => {
          const st = contactStatus(c);
          const f = folderOf(c);
          const links = [
            c.website ? `<a href="${esc(/^https?:/.test(c.website) ? c.website : 'https://' + c.website)}" target="_blank" rel="noopener">web</a>` : '',
            c.instagram ? `<a href="https://instagram.com/${esc(c.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, ''))}" target="_blank" rel="noopener">ig</a>` : '',
            c.email ? `<a href="mailto:${esc(c.email)}">email</a>` : '',
          ].filter(Boolean).join(' · ');
          return `<tr class="${ui.selected.has(c.id) ? 'is-selected' : ''}">
            <td class="check"><input type="checkbox" data-select="${c.id}" ${ui.selected.has(c.id) ? 'checked' : ''} aria-label="Select ${esc(contactLabel(c))}"></td>
            <td><strong>${esc(c.propertyName || '—')}</strong>${links ? `<div class="small">${links}</div>` : ''}</td>
            ${showContact ? `<td>${esc(c.name || '')}${c.notes ? `<div class="muted small clamp" title="${esc(c.notes)}">${esc(c.notes)}</div>` : ''}</td>` : ''}
            <td class="mono nowrap">${esc(L.formatPhone(c.phone))}</td>
            <td>${esc([c.city, c.country].filter(Boolean).join(', '))}</td>
            ${showFolder ? `<td>${f ? `<button class="folder-chip" data-action="folder-open" data-id="${f.id}">${esc(f.name)}</button>` : '<span class="muted small">—</span>'}</td>` : ''}
            <td class="nowrap">${esc(fmtRelative(c.lastSentAt || c.lastOpenedAt))}</td>
            <td><span class="pill pill-${st.key}">${esc(st.label)}</span></td>
            <td class="right nowrap">
              <button class="btn btn-sm btn-primary" data-action="load-contact" data-id="${c.id}">Message →</button>
              <button class="btn btn-sm" data-action="edit-contact" data-id="${c.id}">Edit</button>
              <button class="btn btn-sm btn-ghost danger" data-action="delete-contact" data-id="${c.id}" aria-label="Delete ${esc(contactLabel(c))}">✕</button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
      <div class="table-foot muted small">${rows.length} ${rows.length === 1 ? 'lead' : 'leads'}${ui.folder === 'all' ? '' : ` in this ${ui.folder === 'none' ? 'view' : 'folder'}`} · ${db.contacts.length} in total</div>`;
    syncSelectAll();
  }

  function syncSelectAll() {
    const all = $('#select-all');
    if (!all) return;
    const ids = contactsInView().map((c) => c.id);
    const n = ids.filter((id) => ui.selected.has(id)).length;
    all.checked = n > 0 && n === ids.length;
    all.indeterminate = n > 0 && n < ids.length;
    $$('#contacts-body tr').forEach((tr) => {
      const box = $('input[data-select]', tr);
      if (box) tr.classList.toggle('is-selected', box.checked);
    });
  }

  function renderFolderList() {
    const list = $('#folder-list');
    if (!list) return;
    const counts = folderCounts();
    const item = (id, name, cls = '') => `<li><button class="folder-item ${ui.folder === id ? 'on' : ''} ${cls}" data-action="folder-open" data-id="${id}">
      <span class="folder-name">${esc(name)}</span><span class="count">${counts[id] || 0}</span></button></li>`;
    list.innerHTML = item('all', 'All leads', 'folder-meta') +
      sortedFolders().map((f) => item(f.id, f.name)).join('') +
      item('none', 'No folder', 'folder-meta');
  }

  function renderFolderHead() {
    const head = $('#folder-head');
    if (!head) return;
    const f = getFolder(ui.folder);
    head.innerHTML = f ? `
      <h2 class="folder-title">${esc(f.name)}</h2>
      <button class="btn btn-sm" data-action="folder-rename" data-id="${f.id}">Rename</button>
      <button class="btn btn-sm btn-ghost danger" data-action="folder-delete" data-id="${f.id}">Delete folder</button>`
      : `<h2 class="folder-title">${ui.folder === 'none' ? 'Leads without a folder' : 'All leads'}</h2>`;
  }

  function renderBulkBar() {
    const bar = $('#bulk-bar');
    if (!bar) return;
    const n = ui.selected.size;
    const inView = contactsInView().length;
    if (!n) {
      bar.innerHTML = inView ? `<div class="bulk bulk-idle"><span>Tick leads to move or delete several at once.</span>
        <button class="btn btn-sm btn-ghost" data-action="bulk-select-all">Select all ${inView}</button></div>` : '';
      return;
    }
    bar.innerHTML = `
      <div class="bulk">
        <strong>${n} selected</strong>
        ${n < inView ? `<button class="btn btn-sm btn-ghost" data-action="bulk-select-all">Select all ${inView}</button>` : ''}
        <label class="bulk-move">Move to
          <select id="bulk-folder"><option value="" disabled selected>Choose folder…</option>${folderOptions(null, { none: 'No folder' }).replace('<option value="">', '<option value="__none">')}</select>
        </label>
        <button class="btn btn-sm btn-danger" data-action="bulk-delete">Delete ${plural(n, 'lead', 'leads')}</button>
        <button class="btn btn-sm btn-ghost" data-action="bulk-clear">Clear selection</button>
      </div>`;
    $('#bulk-folder').addEventListener('change', async (e) => {
      let id = e.target.value;
      if (id === '__new') {
        const f = await newFolderModal();
        if (!f) { renderBulkBar(); return; }
        id = f.id;
      }
      moveContacts([...ui.selected], id === '__none' ? null : id);
    });
  }

  function moveContacts(ids, folderId) {
    ids.forEach((id) => { const c = getContact(id); if (c) c.folderId = folderId; });
    save();
    const f = getFolder(folderId);
    toast(`Moved ${ids.length} ${ids.length === 1 ? 'lead' : 'leads'} to ${f ? f.name : 'No folder'}`);
    ui.selected.clear();
    renderContactsBody();
  }

  /** Ask for a folder name in the page (window.prompt is blocked in some hosts). Resolves to the new folder, or null. */
  function newFolderModal({ title = 'New folder', initial = '', submit = 'Create folder' } = {}) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
      openModal(title, `
        <form id="folder-form">
          <div class="field"><label for="folder-name">Folder name</label>
            <input id="folder-name" maxlength="80" required value="${esc(initial)}" placeholder="e.g. Medellín villas, Tulum hotels, Hot leads" autocomplete="off"></div>
          <div class="row-end">
            <button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">${esc(submit)}</button>
          </div>
        </form>`, (root) => {
        const input = $('#folder-name', root);
        input.focus(); input.select();
        modalCloseHook = () => finish(null);
        $('#folder-form', root).addEventListener('submit', (e) => {
          e.preventDefault();
          const name = input.value.trim();
          if (!name) return;
          const clash = db.folders.find((f) => f.name.toLowerCase() === name.toLowerCase());
          if (initial) { // rename
            if (clash && clash.name !== initial) { toast(`There’s already a folder called ${clash.name}.`, 'warn'); return; }
            finish(name); closeModal(); return;
          }
          const f = ensureFolder(name);
          save();
          finish(f);
          closeModal();
        });
      });
    });
  }

  function editContactModal(id) {
    const c = id ? getContact(id) : null;
    const v = (k) => esc(c ? (k === 'phone' ? L.formatPhone(c.phone) : c[k] || '') : '');
    const defaultFolder = c ? (folderOf(c) ? c.folderId : '') : (getFolder(ui.folder) ? ui.folder : '');
    openModal(c ? 'Edit lead' : 'Add lead', `
      <form id="contact-form" class="vars-grid">
        ${CONTACT_FIELDS.map(([k, label]) => k === 'notes'
          ? `<div class="field span-2"><label for="cf-${k}">${label}</label><textarea id="cf-${k}" name="${k}" rows="3">${v(k)}</textarea></div>`
          : `<div class="field"><label for="cf-${k}">${label}${k === 'phone' ? ' *' : ''}</label><input id="cf-${k}" name="${k}" value="${v(k)}" ${k === 'phone' ? 'type="tel" required placeholder="+57 300 123 4567"' : ''} ${k === 'propertyType' ? 'list="pt-list"' : ''} autocomplete="off"></div>`).join('')}
        <div class="field"><label for="cf-folder">Folder</label><select id="cf-folder" name="folder">${folderOptions(defaultFolder)}</select></div>
        <div class="field" id="cf-folder-new-wrap" hidden><label for="cf-folder-new">New folder name</label><input id="cf-folder-new" maxlength="80" autocomplete="off"></div>
        <div class="span-2 row-end">
          <button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">Save lead</button>
        </div>
      </form>`, (root) => {
      const form = $('#contact-form', root);
      $('input', form).focus();
      const sel = $('#cf-folder', form);
      sel.addEventListener('change', () => {
        $('#cf-folder-new-wrap', form).hidden = sel.value !== '__new';
        if (sel.value === '__new') $('#cf-folder-new', form).focus();
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        const n = L.normalizePhone(data.phone, db.settings.defaultCountryCode);
        if (!n.ok) { toast(n.error || 'Enter a WhatsApp number.', 'warn'); $('#cf-phone', form).focus(); return; }
        const dupe = contactByPhone(n.digits);
        if (dupe && (!c || dupe.id !== c.id)) { toast(`${L.formatPhone(n.digits)} already belongs to ${contactLabel(dupe)}.`, 'warn'); return; }
        let folderId = sel.value || null;
        if (folderId === '__new') {
          const f = ensureFolder($('#cf-folder-new', form).value);
          if (!f) { toast('Type a name for the new folder.', 'warn'); $('#cf-folder-new', form).focus(); return; }
          folderId = f.id;
        }
        const target = c || { id: uid(), extra: {}, createdAt: nowIso(), lastOpenedAt: null, lastSentAt: null, followUp: null };
        CONTACT_FIELDS.forEach(([k]) => { target[k] = k === 'phone' ? n.digits : (data[k] || '').trim(); });
        target.folderId = folderId;
        if (!c) db.contacts.unshift(target);
        save();
        closeModal();
        toast(`Saved ${contactLabel(target)}`);
        renderContactsBody();
      });
    });
  }

  /** Paste (or import) a list of leads, preview it, then add it to a folder. */
  function pasteLeadsModal(prefill) {
    const initialFolder = getFolder(ui.folder) ? ui.folder : '';
    openModal('Paste leads', `
      <div class="paste">
        <div class="field">
          <label for="paste-text">Copy rows from Google Sheets or Excel and paste them here, or type one lead per line</label>
          <textarea id="paste-text" rows="7" spellcheck="false" placeholder="Casa Libia, +57 300 123 4567, Medellín&#10;Villa Serena, +57 310 555 0101, Cartagena&#10;Hotel Azul	+52 998 123 4567	Tulum">${esc(prefill || '')}</textarea>
          <div class="hint">Without a header row, each line is read as property, number, location in any order (the number is found automatically). With a header row, columns like <em>property</em>, <em>phone</em>/<em>whatsapp</em>, <em>location</em>, <em>name</em>, <em>notes</em> or <em>folder</em> can be in any order.</div>
        </div>
        <div class="vars-grid">
          <div class="field"><label for="paste-folder">Add to folder</label><select id="paste-folder">${folderOptions(initialFolder)}</select></div>
          <div class="field" id="paste-folder-new-wrap" hidden><label for="paste-folder-new">New folder name</label><input id="paste-folder-new" maxlength="80" placeholder="e.g. Cartagena villas" autocomplete="off"></div>
        </div>
        <div id="paste-preview" aria-live="polite"></div>
        <div class="row-end">
          <button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="paste-import" disabled>Add leads</button>
        </div>
      </div>`, (root) => {
      root.querySelector('.modal').classList.add('modal-wide');
      const ta = $('#paste-text', root);
      const sel = $('#paste-folder', root);
      const newWrap = $('#paste-folder-new-wrap', root);
      const btn = $('#paste-import', root);
      let parsed = { leads: [], skipped: [] };

      const refresh = () => {
        parsed = L.parseLeads(ta.value, db.settings.defaultCountryCode);
        const box = $('#paste-preview', root);
        const n = parsed.leads.length;
        btn.disabled = !n;
        btn.textContent = n ? `Add ${n} ${n === 1 ? 'lead' : 'leads'}` : 'Add leads';
        if (!ta.value.trim()) { box.innerHTML = ''; return; }
        const known = parsed.leads.filter((l) => contactByPhone(l.phone)).length;
        const shown = parsed.leads.slice(0, 100);
        box.innerHTML = `
          <div class="paste-summary">
            <strong>${n} ${n === 1 ? 'lead' : 'leads'} found</strong>${parsed.hasHeader ? ' <span class="pill pill-scheduled">header row detected</span>' : ''}
            ${known ? `<span class="muted"> · ${known} already saved (their empty fields will be filled in)</span>` : ''}
          </div>
          ${n ? `<div class="table-wrap paste-table"><table class="table">
            <thead><tr><th>Property</th><th>Number</th><th>Location</th><th>Other</th><th></th></tr></thead>
            <tbody>${shown.map((l) => `<tr>
              <td>${esc(l.propertyName || '—')}</td>
              <td class="mono nowrap">${esc(L.formatPhone(l.phone))}</td>
              <td>${esc(l.city || '')}</td>
              <td class="muted small">${esc([l.name, l.country, l.folder && 'Folder: ' + l.folder, l.notes].filter(Boolean).join(' · '))}</td>
              <td>${contactByPhone(l.phone) ? '<span class="pill pill-new">saved</span>' : '<span class="pill pill-sent">new</span>'}</td>
            </tr>`).join('')}</tbody>
          </table></div>${n > shown.length ? `<div class="muted small">…and ${n - shown.length} more</div>` : ''}` : ''}
          ${parsed.skipped.length ? `<details class="skipped"><summary>${parsed.skipped.length} ${parsed.skipped.length === 1 ? 'line' : 'lines'} skipped</summary>
            <ul>${parsed.skipped.slice(0, 50).map((x) => `<li><span class="mono">${esc(x.text || '(empty)')}</span> <span class="muted">— ${esc(x.reason)}</span></li>`).join('')}</ul>
            ${!db.settings.defaultCountryCode && parsed.skipped.some((x) => /country code/i.test(x.reason)) ? '<p class="small">Tip: set a default country code in Settings to accept numbers without one.</p>' : ''}
          </details>` : ''}`;
      };

      ta.addEventListener('input', refresh);
      sel.addEventListener('change', () => { newWrap.hidden = sel.value !== '__new'; if (!newWrap.hidden) $('#paste-folder-new', root).focus(); });
      btn.addEventListener('click', () => {
        let folderId = sel.value || null;
        if (folderId === '__new') {
          const f = ensureFolder($('#paste-folder-new', root).value);
          if (!f) { toast('Type a name for the new folder.', 'warn'); $('#paste-folder-new', root).focus(); return; }
          folderId = f.id;
        }
        let added = 0; let updated = 0;
        const batchStart = Date.now();
        for (const lead of parsed.leads) {
          const exists = contactByPhone(lead.phone);
          const patch = {};
          for (const field of Object.keys(L.LEAD_HEADERS)) {
            if (field === 'phone' || field === 'folder' || !lead[field]) continue;
            if (!exists || !exists[field]) patch[field] = lead[field];
          }
          const c = upsertContact(lead.phone, patch);
          if (!exists) c.createdAt = new Date(batchStart + added).toISOString(); // keeps paste order in the lead list
          const target = folderId || (lead.folder ? ensureFolder(lead.folder).id : null);
          if (target) c.folderId = target;
          if (exists) updated++; else added++;
        }
        save();
        closeModal();
        if (folderId) ui.folder = folderId;
        ui.queue.folder = folderId || 'all'; saveQueuePrefs(); // Quick Send's lead list goes through what you just added
        if (ui.view === 'contacts') renderContacts(); else go('contacts');
        const f = getFolder(folderId);
        toast(`Added ${added} new ${added === 1 ? 'lead' : 'leads'}${updated ? `, updated ${updated}` : ''}${f ? ` in ${f.name}` : ''}${parsed.skipped.length ? ` · skipped ${parsed.skipped.length}` : ''}.`);
      });
      refresh();
      ta.focus();
    });
  }

  function exportCSV() {
    const rows = [CONTACT_FIELDS.map(([, l]) => l).concat(['Folder', 'Last opened', 'Last sent', 'Follow-up due'])];
    const list = ui.view === 'contacts' ? contactsInView() : db.contacts;
    list.forEach((c) => rows.push(CONTACT_FIELDS.map(([k]) => (k === 'phone' ? L.formatPhone(c.phone) : c[k] || ''))
      .concat([folderOf(c) ? folderOf(c).name : '', c.lastOpenedAt || '', c.lastSentAt || '', c.followUp ? c.followUp.due : ''])));
    const f = getFolder(ui.folder);
    const slug = f ? '-' + f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '';
    download(`roam-leads${slug}-${L.localDate(new Date())}.csv`, L.toCSV(rows), 'text/csv');
  }

  // ---------------------------------------------------------------------------
  // Templates
  // ---------------------------------------------------------------------------

  function renderTemplates() {
    if (!getTemplate(ui.tplSelected)) ui.tplSelected = db.templates[0] ? db.templates[0].id : null;
    main().innerHTML = `
      <div class="page">
        <div class="page-head">
          <h1>Templates</h1>
          <p class="muted">Use <code>{{property_name}}</code>, <code>{{city}}</code> (location), <code>{{first_name}}</code>, <code>{{property_type}}</code> — or any <code>{{custom_field}}</code>. Changes save automatically.</p>
        </div>
        <div class="tpl-layout">
          <section class="card flush tpl-list-card">
            <div class="card-head pad"><h2>All templates</h2><button class="btn btn-sm btn-primary" data-action="tpl-new">+ New</button></div>
            <ul class="tpl-list" id="tpl-list"></ul>
          </section>
          <section class="card" id="tpl-editor"></section>
        </div>
      </div>`;
    renderTemplateList();
    renderTemplateEditor();
  }

  function renderTemplateList() {
    const list = $('#tpl-list');
    if (!list) return;
    const byCat = {};
    db.templates.forEach((t) => { (byCat[t.category || 'Other'] = byCat[t.category || 'Other'] || []).push(t); });
    list.innerHTML = Object.entries(byCat).map(([cat, ts]) => `
      <li class="tpl-cat">${esc(cat)}</li>
      ${ts.map((t) => `<li><button class="tpl-item ${t.id === ui.tplSelected ? 'on' : ''} ${t.active ? '' : 'inactive'}" data-action="tpl-select" data-id="${t.id}">
        <span>${esc(t.name || 'Untitled')}</span>${t.active ? '' : '<span class="pill pill-new">off</span>'}
      </button></li>`).join('')}`).join('') || '<li class="empty small">No templates yet.</li>';
  }

  function renderTemplateEditor() {
    const box = $('#tpl-editor');
    const t = getTemplate(ui.tplSelected);
    if (!t) { box.innerHTML = `<div class="empty">Create a template to get started.</div>`; return; }
    box.innerHTML = `
      <div class="tpl-editor">
        <div class="vars-grid">
          <div class="field"><label for="tpl-name">Name</label><input id="tpl-name" data-tfield="name" value="${esc(t.name)}"></div>
          <div class="field"><label for="tpl-cat">Category</label><input id="tpl-cat" data-tfield="category" value="${esc(t.category)}" list="cat-list" placeholder="Introduction"></div>
        </div>
        <div class="field">
          <div class="label-row"><label for="tpl-body">Message</label>
            <span class="insert">Insert: ${Object.keys(KNOWN_VARS).map((k) => `<button class="chip chip-sm" data-action="tpl-insert" data-var="${k}">{{${k}}}</button>`).join('')}</span>
          </div>
          <textarea id="tpl-body" data-tfield="body" rows="12">${esc(t.body)}</textarea>
        </div>
        <div class="tpl-vars">Variables: <span id="tpl-vars"></span></div>
        <div class="tpl-foot">
          <label class="switch"><input type="checkbox" id="tpl-active" ${t.active ? 'checked' : ''}><span></span> Active <span class="muted small">(shown in Quick Send)</span></label>
          <span class="spacer"></span>
          <span class="muted small" id="tpl-saved"></span>
          <button class="btn" data-action="tpl-use">Use in Quick Send</button>
          <button class="btn" data-action="tpl-duplicate">Duplicate</button>
          <button class="btn btn-ghost danger" data-action="tpl-delete">Delete</button>
        </div>
        <div class="field">
          <label>Preview <span class="muted small">(sample data)</span></label>
          <div class="chat"><div id="tpl-preview"></div></div>
        </div>
      </div>`;
    updateTemplateDerived(t);
    let timer;
    $$('[data-tfield]', box).forEach((el) => el.addEventListener('input', () => {
      t[el.dataset.tfield] = el.value;
      t.updatedAt = nowIso();
      updateTemplateDerived(t);
      if (el.dataset.tfield !== 'body') renderTemplateList();
      clearTimeout(timer);
      const status = $('#tpl-saved');
      status.textContent = 'Saving…';
      timer = setTimeout(() => { save(); status.textContent = 'Saved'; }, 300);
    }));
    $('#tpl-active').addEventListener('change', (e) => {
      t.active = e.target.checked; save(); renderTemplateList();
      toast(`${t.name} ${t.active ? 'activated' : 'deactivated'}`);
    });
  }

  function updateTemplateDerived(t) {
    const vars = L.extractVariables(t.body);
    $('#tpl-vars').innerHTML = vars.length ? vars.map((v) => `<code>${esc(v)}</code>`).join(' ') : '<span class="muted">none</span>';
    const sample = { first_name: 'Carlos', property_name: 'Casa Libia', city: 'Medellín', property_type: 'villa', country: 'Colombia' };
    $('#tpl-preview').innerHTML = `<div class="bubble">${L.templateSegments(t.body, sample).map((s) =>
      s.type === 'text' ? esc(s.text) : s.type === 'var' ? `<mark class="v-ok">${esc(s.text)}</mark>` : `<mark class="v-missing">${esc(s.text)}</mark>`).join('') || '<span class="muted">Empty message</span>'}</div>`;
  }

  function insertAtCursor(ta, text) {
    const start = ta.selectionStart; const end = ta.selectionEnd;
    ta.setRangeText(text, start, end, 'end');
    ta.focus();
    ta.dispatchEvent(new Event('input'));
  }

  // ---------------------------------------------------------------------------
  // Sign in
  // ---------------------------------------------------------------------------

  function renderAuth() {
    const a = ui.auth;
    const signup = a.mode === 'signup';
    main().innerHTML = `
      <div class="auth">
        <section class="card">
          <h1>${signup ? 'Create your account' : 'Sign in'}</h1>
          <p class="muted">Your templates, leads, history and follow-ups are saved to Roam’s database, so they’re there on any computer or phone.</p>
          ${a.message ? `<div class="notice ${a.error ? 'notice-err' : ''}" role="status">${esc(a.message)}</div>` : ''}
          <form id="auth-form">
            <div class="field"><label for="auth-email">Email</label>
              <input id="auth-email" name="email" type="email" autocomplete="email" required value="${esc(a.email || '')}"></div>
            <div class="field"><label for="auth-password">Password</label>
              <input id="auth-password" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="6" required></div>
            <button class="btn btn-primary btn-block" type="submit" ${a.busy ? 'disabled' : ''}>${a.busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}</button>
          </form>
          <p class="small center">${signup
            ? 'Already have an account? <button class="link" data-action="auth-mode" data-mode="signin">Sign in</button>'
            : 'First time? <button class="link" data-action="auth-mode" data-mode="signup">Create an account</button>'}</p>
        </section>
        <p class="small center muted"><button class="link muted-link" data-action="use-local">Use without an account</button> — data stays in this browser only.</p>
      </div>`;
    const form = $('#auth-form');
    $(a.email ? '#auth-password' : '#auth-email').focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = form.email.value.trim();
      const password = form.password.value;
      ui.auth = { ...a, email, busy: true, message: '', error: false };
      renderAuth();
      try {
        const session = signup ? await cloud.signUp(email, password) : await cloud.signIn(email, password);
        if (session) { setMode('cloud'); await startCloud(); return; }
        ui.auth = { mode: 'signin', email, message: 'Check your email and click the confirmation link, then sign in here.' };
      } catch (err) {
        const msg = /fetch|network|load failed/i.test(err.message) ? 'Can’t reach the database from here. Check your connection, or use the console without an account.'
          : /invalid login/i.test(err.message) ? 'Wrong email or password.'
          : /not confirmed/i.test(err.message) ? 'Confirm your email first — check your inbox for the link.'
            : err.message || 'Something went wrong. Try again.';
        ui.auth = { mode: a.mode, email, message: msg, error: true };
      }
      renderAuth();
    });
  }

  async function signOut() {
    try { await flushSync(); } catch (e) { /* keep going */ }
    if (sync.dirty || sync.state === 'error') {
      if (!(await ask('Some changes haven’t reached the database yet and will be lost if you sign out.', 'Sign out anyway'))) return;
    }
    clearTimeout(sync.timer);
    await cloud.signOut();
    try { localStorage.removeItem(storeKey); } catch (e) { /* ignore */ }
    db = freshDb();
    sync.snapshot = null; sync.dirty = false;
    ui.ready = false;
    ui.pending = null;
    ui.auth = { mode: 'signin' };
    setSync('off');
    render();
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  function renderSettings() {
    const s = db.settings;
    main().innerHTML = `
      <div class="page narrow">
        <div class="page-head"><h1>Settings</h1></div>
        <section class="card">
          <h2>WhatsApp</h2>
          <div class="field">
            <label for="set-cc">Default country code</label>
            <div class="with-prefix"><span>+</span><input id="set-cc" inputmode="numeric" value="${esc(s.defaultCountryCode)}" placeholder="57" maxlength="4"></div>
            <div class="hint">Added to numbers typed without a country code (e.g. <span class="mono">300 123 4567</span> → <span class="mono">+57 300 123 4567</span>). Leave empty to always require one.</div>
          </div>
          <fieldset class="field">
            <legend>Open chats in</legend>
            ${[['auto', 'Automatic', 'WhatsApp Web on computers, the WhatsApp app on phones'],
              ['web', 'WhatsApp Web', 'Opens straight into the chat in one reusable browser tab'],
              ['app', 'WhatsApp desktop app', 'Requires WhatsApp installed on this computer'],
              ['wa', 'wa.me link', 'WhatsApp’s universal link (shows a “Continue to chat” page on desktop)']]
              .map(([v, l, d]) => `<label class="radio"><input type="radio" name="open-mode" value="${v}" ${s.openMode === v ? 'checked' : ''}> <span><strong>${l}</strong><br><span class="muted small">${d}</span></span></label>`).join('')}
          </fieldset>
        </section>
        ${cloudActive() ? `
        <section class="card">
          <h2>Account</h2>
          <p class="small">Signed in as <strong>${esc(cloud.user.email)}</strong>. Everything is saved to the database and available wherever you sign in.</p>
          <div class="row"><button class="btn" data-action="sign-out">Sign out</button></div>
        </section>` : cloud.enabled ? `
        <section class="card">
          <h2>Account</h2>
          <p class="small">You’re using the console without an account, so data stays in this browser only. Sign in to save it to the database — this browser’s data is uploaded the first time you sign in to a new account.</p>
          <div class="row"><button class="btn btn-primary" data-action="use-cloud">Sign in to sync</button></div>
        </section>` : ''}
        <section class="card">
          <h2>Data</h2>
          <p class="muted small">${cloudActive() ? 'Your account has' : 'This browser has'} ${db.contacts.length} contacts, ${db.outreach.length} outreach entries and ${db.templates.length} templates.${cloudActive() ? ' A backup file is a handy extra copy.' : ' Export a backup regularly, and use it to move to another computer.'}</p>
          <div class="row">
            <button class="btn" data-action="backup-export">Export backup (.json)</button>
            <button class="btn" data-action="backup-import">Restore backup…</button>
            <button class="btn" data-action="restore-templates">Restore default templates</button>
          </div>
          <div class="row"><button class="btn btn-ghost danger" data-action="wipe">Erase all data…</button></div>
        </section>
        <p class="muted small center" id="app-version">Roam Outreach version ${esc(APP_VERSION)}</p>
      </div>`;
    const cc = $('#set-cc');
    cc.addEventListener('input', () => {
      cc.value = cc.value.replace(/\D/g, '');
      db.settings.defaultCountryCode = cc.value; save();
    });
    $$('input[name="open-mode"]').forEach((r) => r.addEventListener('change', () => { db.settings.openMode = r.value; save(); toast('Saved'); }));
  }

  // ---------------------------------------------------------------------------
  // Modal, toast, files
  // ---------------------------------------------------------------------------

  let lastFocus = null;
  function openModal(title, bodyHtml, onMount) {
    if (modalCloseHook) { const hook = modalCloseHook; modalCloseHook = null; hook(); }
    lastFocus = document.activeElement;
    const root = $('#modal');
    root.innerHTML = `<div class="modal-backdrop" data-action="close-modal"></div>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-head"><h2 id="modal-title">${esc(title)}</h2><button class="btn btn-ghost btn-sm" data-action="close-modal" aria-label="Close">✕</button></div>
        <div class="modal-body">${bodyHtml}</div>
      </div>`;
    root.hidden = false;
    if (onMount) onMount(root);
  }

  let modalCloseHook = null; // resolves a pending ask()/newFolderModal() when the dialog is dismissed

  function closeModal() {
    if (modalCloseHook) { const hook = modalCloseHook; modalCloseHook = null; hook(); }
    const root = $('#modal');
    root.hidden = true;
    root.innerHTML = '';
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  /** In-page replacement for window.confirm(), which some hosts (e.g. sandboxed frames) silently refuse. */
  function ask(message, confirmLabel, { danger = true } = {}) {
    return new Promise((resolve) => {
      openModal('Are you sure?', `
        <p>${esc(message)}</p>
        <div class="row-end">
          <button class="btn btn-ghost" id="ask-no">Cancel</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="ask-yes">${esc(confirmLabel)}</button>
        </div>`, (root) => {
        let settled = false;
        const done = (v) => { if (!settled) { settled = true; resolve(v); } closeModal(); };
        modalCloseHook = () => done(false);
        $('#ask-yes', root).addEventListener('click', () => done(true));
        $('#ask-no', root).addEventListener('click', () => done(false));
        $('#ask-yes', root).focus();
      });
    });
  }

  function rescheduleModal(contactId) {
    const c = getContact(contactId);
    if (!c) return;
    openModal(`Follow-up with ${contactLabel(c)}`, `
      ${c.followUp ? `<p class="muted small">Currently due ${esc(fmtDue(c.followUp.due))}.</p>` : ''}
      ${schedulerHtml(contactId)}
      ${c.followUp ? `<div class="row-end"><button class="btn btn-ghost danger" data-action="fu-cancel" data-id="${c.id}">Remove follow-up</button></div>` : ''}`);
  }

  let toastTimer;
  function toast(msg, kind, linkUrl) {
    const el = $('#toast');
    el.className = 'toast show' + (kind ? ' toast-' + kind : '');
    el.innerHTML = esc(msg) + (linkUrl ? ` <a href="${esc(linkUrl)}" target="_blank" rel="noopener">Open chat</a>` : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, linkUrl ? 9000 : 3200);
  }

  /** Toast with an Undo button; deletes happen immediately and can be reversed for a few seconds. */
  function toastUndo(msg, undo) {
    const el = $('#toast');
    el.className = 'toast show';
    el.innerHTML = `<span>${esc(msg)}</span> <button type="button" class="toast-btn">Undo</button>`;
    let used = false;
    $('.toast-btn', el).addEventListener('click', () => {
      if (used) return;
      used = true;
      undo();
      toast('Restored');
    });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, 8000);
  }

  /** Re-render whatever is on screen after data changed. */
  function refreshView() {
    updateNavBadge();
    if (ui.view === 'contacts') renderContactsBody();
    else if (ui.view === 'history') renderHistory();
    else if (ui.view === 'templates') renderTemplates();
    else if (ui.view === 'followups') renderFollowUps();
    else if (ui.view === 'send') { renderRecents(); updatePhoneHint(); }
  }

  /** Remove matching items from db[coll] and offer Undo, which puts them back where they were. */
  function removeWithUndo(coll, match, message, { canRestore = () => true, afterUndo } = {}) {
    const removed = [];
    db[coll] = db[coll].filter((item, i) => (match(item) ? (removed.push([i, item]), false) : true));
    if (!removed.length) return 0;
    save();
    refreshView();
    toastUndo(message, () => {
      for (const [i, item] of removed) {
        if (db[coll].some((x) => x.id === item.id) || !canRestore(item)) continue;
        db[coll].splice(Math.min(i, db[coll].length), 0, item);
      }
      if (afterUndo) afterUndo();
      save();
      refreshView();
    });
    return removed.length;
  }

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const restorableContact = (c) => !contactByPhone(c.phone); // skip if the number was re-added meanwhile

  function deleteContacts(ids) {
    const set = new Set(ids);
    const one = ids.length === 1 && getContact(ids[0]);
    if (set.has(ui.qs.contactId)) ui.qs.contactId = null;
    ids.forEach((id) => ui.selected.delete(id));
    removeWithUndo('contacts', (c) => set.has(c.id), one ? `Deleted ${contactLabel(one)}` : `Deleted ${plural(ids.length, 'lead', 'leads')}`, { canRestore: restorableContact });
  }

  function deleteOutreach(ids) {
    const set = new Set(ids);
    ids.forEach((id) => ui.historySelected.delete(id));
    if (ui.pending && set.has(ui.pending.outreachId)) ui.pending = null;
    removeWithUndo('outreach', (o) => set.has(o.id), `Deleted ${plural(ids.length, 'history entry', 'history entries')}`);
  }

  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function pickFile(accept, cb) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => cb(String(reader.result));
      reader.readAsText(f);
    });
    input.click();
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  function schedFrom(el) {
    const s = el.closest('.sched');
    return { contactId: s.dataset.contact, templateId: $('.fu-template', s).value, date: $('.fu-date', s) };
  }

  function afterSchedule() {
    if (!$('#modal').hidden) closeModal();
    if (ui.view === 'send' && ui.pending) { ui.pending.stage = 'done'; renderAfter(); }
    if (ui.view === 'history') renderHistoryBody();
    if (ui.view === 'followups') renderFollowUps();
    if (ui.view === 'contacts') renderContactsBody();
  }

  const actions = {
    'open-wa': () => openWhatsApp(),
    'mark-sent': (el) => {
      markSent(el.dataset.id);
      if (ui.view === 'send') refreshSendAfterSent();
      if (ui.view === 'history') renderHistory();
    },
    'no-whatsapp': (el) => {
      markNoWhatsapp([el.dataset.id]);
      if (ui.view === 'send') renderAfter();
    },
    'history-bulk-nowa': () => {
      const ids = [...ui.historySelected];
      ui.historySelected.clear();
      markNoWhatsapp(ids);
    },
    reopen: (el) => {
      const o = getOutreach(el.dataset.id);
      if (!o) return;
      const mode = resolveMode();
      openUrl(L.buildWhatsAppUrl(o.phone, o.message, mode), mode);
    },
    'dismiss-after': () => { ui.pending = null; renderAfter(); toast('Left as “Opened” in history.'); },
    'fu-days': (el) => {
      const s = schedFrom(el);
      scheduleFollowUp(s.contactId, L.addDays(new Date(), Number(el.dataset.days)), s.templateId);
      afterSchedule();
    },
    'fu-date': (el) => {
      const s = schedFrom(el);
      if (!s.date.value) { s.date.focus(); toast('Pick a date first.', 'warn'); return; }
      scheduleFollowUp(s.contactId, s.date.value, s.templateId);
      afterSchedule();
    },
    'fu-skip': () => { ui.pending.stage = 'done'; renderAfter(); },
    'fu-cancel': (el) => {
      const c = getContact(el.dataset.id);
      if (!c) return;
      c.followUp = null; save(); updateNavBadge();
      toast(`Follow-up removed for ${contactLabel(c)}`);
      afterSchedule();
    },
    reschedule: (el) => rescheduleModal(el.dataset.id),
    'load-followup': (el) => loadContact(el.dataset.id, { followUp: true }),
    'load-contact': (el) => {
      if (!$('#modal').hidden) closeModal();
      if (ui.view === 'contacts') { ui.queue.folder = ui.folder; saveQueuePrefs(); } // Next lead continues in this folder
      if (ui.view === 'send' && !ui.pending) {
        // Keep the chosen template (and any follow-up context for the same lead).
        const c = getContact(el.dataset.id);
        if (!c) return;
        ui.qs.isFollowUp = false;
        fillFromContact(c);
        renderSend();
      } else loadContact(el.dataset.id);
    },
    'use-template': (el) => selectTemplate(el.dataset.id),
    'edit-message': () => { ui.qs.override = currentMessage(); updatePreview(); const ta = $('#qs-override'); if (ta) ta.focus(); },
    'reset-edit': () => { ui.qs.override = null; updatePreview(); },
    'qs-clear': () => { autoSaveLead(); clearQuickSend(); },
    'qs-next': () => goQueue(1),
    'qs-prev': () => goQueue(-1),
    'queue-load': (el) => { autoSaveLead(); loadContact(el.dataset.id); },
    'leads-tab': (el) => { ui.queue.tab = el.dataset.tab; saveQueuePrefs(); renderLeadsPanel(); },
    'counter-reset': () => {
      const before = db.settings.counterResetAt;
      const was = sentSinceReset();
      db.settings.counterResetAt = nowIso();
      save(); renderTopBar();
      toastUndo(`Counter reset (was ${was})`, () => { db.settings.counterResetAt = before; save(); renderTopBar(); });
    },
    'save-lead': () => saveLeadFromQS(),

    'history-filter': (el) => { ui.historyFilter = el.dataset.f; ui.historySelected.clear(); renderHistory(); },
    'delete-outreach': (el) => deleteOutreach([el.dataset.id]),
    'history-bulk-clear': () => { ui.historySelected.clear(); renderHistoryBody(); },
    'history-bulk-delete': () => deleteOutreach([...ui.historySelected]),
    'history-bulk-sent': () => {
      const ids = [...ui.historySelected].filter((id) => (getOutreach(id) || {}).status !== 'sent');
      ids.forEach((id) => markSent(id));
      ui.historySelected.clear();
      renderHistory();
      toast(`Marked ${plural(ids.length, 'entry', 'entries')} as sent`);
    },

    'edit-contact': (el) => editContactModal(el.dataset.id),
    'delete-contact': (el) => { if (getContact(el.dataset.id)) deleteContacts([el.dataset.id]); },
    'import-csv': () => pickFile('.csv,.tsv,.txt,text/csv,text/plain', (text) => pasteLeadsModal(text)),
    'paste-leads': () => pasteLeadsModal(''),
    'folder-open': (el) => {
      ui.folder = el.dataset.id; ui.selected.clear();
      if (ui.view === 'contacts') renderContactsBody(); else go('contacts');
    },
    'folder-new': async () => {
      const f = await newFolderModal();
      if (f) { ui.folder = f.id; ui.selected.clear(); renderContactsBody(); toast(`Created ${f.name}`); }
    },
    'folder-rename': async (el) => {
      const f = getFolder(el.dataset.id);
      if (!f) return;
      const name = await newFolderModal({ title: 'Rename folder', initial: f.name, submit: 'Rename' });
      if (name && name !== f.name) { f.name = name.slice(0, 80); save(); renderContactsBody(); toast('Folder renamed'); }
    },
    'folder-delete': (el) => {
      const f = getFolder(el.dataset.id);
      if (!f) return;
      const members = db.contacts.filter((c) => c.folderId === f.id).map((c) => c.id);
      members.forEach((id) => { getContact(id).folderId = null; });
      if (ui.qs.folderId === f.id) ui.qs.folderId = '';
      ui.folder = 'all';
      removeWithUndo('folders', (x) => x.id === f.id,
        `Deleted folder ${f.name}${members.length ? ` · ${plural(members.length, 'lead', 'leads')} moved to No folder` : ''}`, {
          afterUndo: () => {
            members.forEach((id) => { const c = getContact(id); if (c && !c.folderId) c.folderId = f.id; });
            ui.folder = f.id;
          },
        });
    },
    'bulk-clear': () => { ui.selected.clear(); renderContactsBody(); },
    'bulk-delete': () => deleteContacts([...ui.selected]),
    'bulk-select-all': () => { contactsInView().forEach((c) => ui.selected.add(c.id)); renderContactsBody(); },
    'export-csv': () => exportCSV(),

    'tpl-select': (el) => { ui.tplSelected = el.dataset.id; renderTemplateList(); renderTemplateEditor(); },
    'tpl-new': () => {
      const t = { id: uid(), name: 'Roam — New template', category: 'Introduction', body: 'Hi there,\n\nI came across {{property_name}} in {{city}}', active: true, createdAt: nowIso() };
      db.templates.push(t); save();
      ui.tplSelected = t.id; renderTemplateList(); renderTemplateEditor();
      const n = $('#tpl-name'); n.focus(); n.select();
    },
    'tpl-duplicate': () => {
      const t = getTemplate(ui.tplSelected);
      const copy = { ...t, id: uid(), name: t.name + ' (copy)', createdAt: nowIso() };
      db.templates.splice(db.templates.indexOf(t) + 1, 0, copy); save();
      ui.tplSelected = copy.id; renderTemplateList(); renderTemplateEditor();
      toast('Template duplicated');
    },
    'tpl-delete': () => {
      const t = getTemplate(ui.tplSelected);
      if (!t) return;
      ui.tplSelected = null;
      removeWithUndo('templates', (x) => x.id === t.id, `Deleted ${t.name}`, { afterUndo: () => { ui.tplSelected = t.id; } });
    },
    'tpl-insert': (el) => insertAtCursor($('#tpl-body'), `{{${el.dataset.var}}}`),
    'tpl-use': () => {
      const t = getTemplate(ui.tplSelected);
      if (!t.active) { t.active = true; save(); }
      ui.qs.templateId = t.id; ui.qs.override = null; ui.qs.isFollowUp = false;
      go('send');
    },

    'backup-export': () => download(`roam-whatsapp-backup-${L.localDate(new Date())}.json`, JSON.stringify(db, null, 2), 'application/json'),
    'backup-import': () => pickFile('.json,application/json', async (text) => {
      try {
        const data = JSON.parse(text);
        if (!Array.isArray(data.templates) || !Array.isArray(data.contacts) || !Array.isArray(data.outreach)) throw new Error('bad');
        if (!(await ask(`Replace current data with this backup (${data.contacts.length} contacts, ${data.outreach.length} outreach entries)?`, 'Replace data'))) return;
        db = { ...freshDb(), ...data, settings: { ...freshDb().settings, ...(data.settings || {}) } };
        save(); ui.qs = freshQS(); ui.pending = null; render();
        toast('Backup restored');
      } catch (e) { toast('That file isn’t a valid backup.', 'warn'); }
    }),
    'restore-templates': () => {
      const names = new Set(db.templates.map((t) => t.name));
      const missing = seedTemplates().filter((t) => !names.has(t.name));
      db.templates.push(...missing); save();
      toast(missing.length ? `Added ${missing.length} default template(s)` : 'All default templates are already there');
    },
    wipe: async () => {
      if (!(await ask(`Erase all contacts, history and templates${cloudActive() ? ' from your account on every device' : ' from this browser'}? Export a backup first if unsure.`, 'Erase everything'))) return;
      db = freshDb(); save(); ui.qs = freshQS(); ui.pending = null; go('send');
      toast('All data erased');
    },
    'close-modal': () => closeModal(),
    'auth-mode': (el) => { ui.auth = { mode: el.dataset.mode, email: ($('#auth-email') || {}).value || '' }; renderAuth(); },
    'use-local': () => { setMode('local'); startLocal(); },
    'use-cloud': () => { setMode('cloud'); ui.ready = false; ui.auth = { mode: 'signin' }; render(); },
    'sign-out': () => signOut(),
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.action];
    if (!fn) return;
    e.preventDefault();
    fn(el);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#modal').hidden) { closeModal(); return; }
    if (ui.view !== 'send' || !$('#modal').hidden) return;
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); openWhatsApp(); }
    else if (e.altKey && e.code === 'KeyS' && ui.pending && ui.pending.stage === 'confirm') { e.preventDefault(); markSent(ui.pending.outreachId); refreshSendAfterSent(); }
    else if (e.altKey && e.code === 'KeyX' && ui.pending) { e.preventDefault(); markNoWhatsapp([ui.pending.outreachId]); renderAfter(); }
    else if (e.altKey && e.code === 'KeyN') { e.preventDefault(); goQueue(1); }
    else if (e.altKey && e.code === 'KeyP') { e.preventDefault(); goQueue(-1); }
  });

  // Another tab changed the data (e.g. two console tabs open) — reload it.
  window.addEventListener('storage', (e) => {
    if (!ui.ready || e.key !== storeKey) return;
    const next = readLocal(storeKey);
    if (!next) return;
    db = normalizeDb(next);
    if (ui.view !== 'send') render(); else { renderRecents(); updateNavBadge(); }
  });

  window.addEventListener('hashchange', render);

  // Datalists shared across forms.
  document.body.insertAdjacentHTML('beforeend',
    `<datalist id="pt-list">${PROPERTY_TYPES.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>` +
    `<datalist id="cat-list">${CATEGORIES.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>`);

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshFromCloud(); });
  window.addEventListener('beforeunload', (e) => {
    if (cloudActive() && (sync.dirty || sync.pushing)) { pushNow(); e.preventDefault(); e.returnValue = ''; }
  });

  async function boot() {
    if (!cloud.enabled || getMode() === 'local') { startLocal(); return; }
    try {
      const session = await cloud.getSession();
      if (session) { await startCloud(); return; }
    } catch (e) {
      console.warn('Could not check the session', e);
    }
    ui.auth = { mode: 'signin' };
    if (!(await cloud.reachable())) {
      ui.auth.message = 'Can’t reach the database from this page, so signing in won’t work here. You can still use the console without an account.';
      ui.auth.error = true;
    }
    render();
  }

  boot();
})();
