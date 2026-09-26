/* Roam WhatsApp Outreach Console — all data lives in this browser's localStorage. */
(function () {
  'use strict';

  const L = window.RoamLib;
  const STORE_KEY = 'roam-wa-console-v1';

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

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
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
      templates: seedTemplates(),
      contacts: [],
      outreach: [],
      settings: { defaultCountryCode: '', openMode: 'auto', lastTemplateId: null },
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const base = freshDb();
        migrateTemplates(data);
        return {
          ...base,
          ...data,
          settings: { ...base.settings, ...(data.settings || {}) },
        };
      }
    } catch (e) {
      console.warn('Could not read saved data', e);
    }
    return freshDb();
  }

  let db = load();
  let storageOk = true;

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(db));
      storageOk = true;
    } catch (e) {
      if (storageOk) toast('Could not save — browser storage is unavailable. Export a backup from Settings.', 'warn');
      storageOk = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Data helpers
  // ---------------------------------------------------------------------------

  const getTemplate = (id) => db.templates.find((t) => t.id === id);
  const getContact = (id) => db.contacts.find((c) => c.id === id);
  const getOutreach = (id) => db.outreach.find((o) => o.id === id);
  const contactByPhone = (digits) => (digits ? db.contacts.find((c) => c.phone === digits) : null);
  const activeTemplates = () => db.templates.filter((t) => t.active);

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
    view: 'send',
    qs: freshQS(),
    pending: null, // { outreachId, stage: 'confirm' | 'followup' | 'done' }
    historyFilter: 'all',
    historySearch: '',
    contactSearch: '',
    tplSelected: null,
  };

  function freshQS(templateId) {
    return {
      phone: '',
      templateId: templateId || defaultTemplateId(),
      fields: {},
      details: { name: '', country: '', website: '', instagram: '', email: '', notes: '' },
      contactId: null,
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
              <button class="btn btn-ghost" data-action="qs-clear" title="Alt+N">Clear / next lead</button>
              <span class="muted small">Leads are remembered automatically when you open WhatsApp.</span>
            </div>
          </section>

          <section class="card recents" aria-label="Recent contacts">
            <div class="card-head">
              <h2>Recent contacts</h2>
              <a href="#contacts" class="small">All contacts →</a>
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
        if (!c || c.phone !== n.digits) { ui.qs.contactId = null; ui.qs.isFollowUp = false; }
      }
      updatePhoneHint();
      updatePreview();
    });
    phone.addEventListener('blur', () => maybeAutofillKnown());

    $('#qs-template').addEventListener('change', (e) => selectTemplate(e.target.value));

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
    qs.override = null;
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

  function openWhatsApp() {
    const qs = ui.qs;
    const btn = $('#qs-open');
    if (!btn || btn.disabled) return;
    const n = L.normalizePhone(qs.phone, db.settings.defaultCountryCode);
    const msg = currentMessage();
    const mode = resolveMode();
    openUrl(L.buildWhatsAppUrl(n.digits, msg, mode), mode);

    const c = upsertContact(n.digits, { ...contactPatchFromQS(), lastOpenedAt: nowIso() });
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
      status: 'opened',
      openedAt: nowIso(),
      sentAt: null,
      isFollowUp: !!qs.isFollowUp,
    };
    db.outreach.unshift(o);
    save();
    qs.contactId = c.id;
    ui.pending = { outreachId: o.id, stage: 'confirm' };
    updatePhoneHint();
    renderAfter();
    renderRecents();
    updateNavBadge();
    const sentBtn = $('#qs-after [data-action="mark-sent"]');
    if (sentBtn) sentBtn.focus();
  }

  function markSent(outreachId) {
    const o = getOutreach(outreachId);
    if (!o || o.status === 'sent') return;
    o.status = 'sent';
    o.sentAt = nowIso();
    const c = getContact(o.contactId);
    if (c) {
      c.lastSentAt = o.sentAt;
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
    } else if (p.stage === 'followup' || (p.stage === 'confirm' && o.status === 'sent')) {
      box.innerHTML = `
        <section class="card after">
          <div class="after-title"><span class="dot dot-sent"></span> Sent to <strong>${who}</strong>. Schedule a follow-up?</div>
          ${schedulerHtml(o.contactId)}
          <div class="row">
            <button class="btn btn-ghost" data-action="fu-skip">No follow-up</button>
            <button class="btn" data-action="qs-clear" title="Alt+N">Next lead →</button>
          </div>
        </section>`;
    } else {
      const due = c && c.followUp ? `Follow-up scheduled ${esc(fmtDue(c.followUp.due))}.` : 'No follow-up scheduled.';
      box.innerHTML = `
        <section class="card after">
          <div class="after-title"><span class="dot dot-sent"></span> Done with <strong>${who}</strong>. ${due}</div>
          <div class="row"><button class="btn btn-primary" data-action="qs-clear" title="Alt+N">Next lead →</button></div>
        </section>`;
      const next = $('[data-action="qs-clear"]', box);
      if (next) next.focus();
    }
  }

  function renderRecents() {
    const box = $('#qs-recents');
    if (!box) return;
    const recents = db.contacts
      .filter((c) => c.lastOpenedAt || c.lastSentAt)
      .sort((a, b) => (b.lastOpenedAt || b.lastSentAt || '').localeCompare(a.lastOpenedAt || a.lastSentAt || ''))
      .slice(0, 8);
    if (!recents.length) {
      box.innerHTML = `<div class="empty small">Contacts you message will show up here — click one to reload it.</div>`;
      return;
    }
    box.innerHTML = `<ul class="recent-list">${recents.map((c) => {
      const st = contactStatus(c);
      return `<li><button class="recent" data-action="load-contact" data-id="${c.id}">
        <span class="recent-main"><strong>${esc(c.propertyName || c.name || '—')}</strong><span class="muted">${esc(c.propertyName ? [c.name, c.city].filter(Boolean).join(' · ') : c.city || '')}</span></span>
        <span class="recent-phone mono">${esc(L.formatPhone(c.phone))}</span>
        <span class="recent-date"><span class="pill pill-${st.key}">${esc(st.label)}</span><span class="muted small">${esc(fmtRelative(c.lastSentAt || c.lastOpenedAt))}</span></span>
      </button></li>`;
    }).join('')}</ul>`;
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
    const counts = { all: db.outreach.length, opened: db.outreach.filter((o) => o.status === 'opened').length, sent: db.outreach.filter((o) => o.status === 'sent').length };
    main().innerHTML = `
      <div class="page">
        <div class="page-head">
          <h1>Outreach history</h1>
          <p class="muted">“Opened” means the chat was opened with the message; only “Sent” means you pressed Send.</p>
        </div>
        <div class="toolbar">
          <div class="seg" role="group" aria-label="Filter by status">
            ${['all', 'opened', 'sent'].map((f) => `<button class="${ui.historyFilter === f ? 'on' : ''}" data-action="history-filter" data-f="${f}">${f === 'all' ? 'All' : f === 'opened' ? 'Opened' : 'Sent'} <span class="count">${counts[f]}</span></button>`).join('')}
          </div>
          <input id="history-search" type="search" placeholder="Search name, property, number…" value="${esc(ui.historySearch)}">
        </div>
        <section class="card flush"><div id="history-body"></div></section>
      </div>`;
    const s = $('#history-search');
    s.addEventListener('input', () => { ui.historySearch = s.value; renderHistoryBody(); });
    renderHistoryBody();
  }

  function renderHistoryBody() {
    const q = ui.historySearch.trim().toLowerCase();
    const rows = db.outreach.filter((o) => {
      if (ui.historyFilter !== 'all' && o.status !== ui.historyFilter) return false;
      if (!q) return true;
      const c = getContact(o.contactId) || {};
      return [c.name || o.contactName, c.propertyName || o.propertyName, o.phone, o.templateName, o.message].join(' ').toLowerCase().includes(q);
    });
    const body = $('#history-body');
    if (!rows.length) {
      body.innerHTML = `<div class="empty">${db.outreach.length ? 'Nothing matches.' : 'No outreach yet. Every time you open WhatsApp from Quick Send it’s logged here.'}</div>`;
      return;
    }
    body.innerHTML = `
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Date</th><th>Contact</th><th>Number</th><th>Template</th><th>Status</th><th class="right">Actions</th></tr></thead>
        <tbody>${rows.map((o) => {
          const c = getContact(o.contactId);
          const person = (c && c.name) || o.contactName || '';
          const prop = (c && c.propertyName) || o.propertyName || '';
          const name = prop || person || '—';
          const sub = prop ? [person, c && c.city].filter(Boolean).join(' · ') : '';
          return `<tr>
            <td class="nowrap">${esc(fmtDateTime(o.openedAt))}</td>
            <td><strong>${esc(name)}</strong>${sub ? `<div class="muted small">${esc(sub)}</div>` : ''}</td>
            <td class="mono nowrap">${esc(L.formatPhone(o.phone))}</td>
            <td>${esc(o.templateName)}${o.isFollowUp ? ' <span class="pill pill-scheduled">follow-up</span>' : ''}
              <details class="msg"><summary>Message</summary><div class="bubble bubble-sm">${esc(o.message)}</div></details></td>
            <td>${o.status === 'sent'
              ? `<span class="pill pill-sent">Sent</span><div class="muted small">${esc(fmtDateTime(o.sentAt))}</div>`
              : '<span class="pill pill-opened">Opened</span>'}</td>
            <td class="right nowrap">
              ${o.status === 'opened' ? `<button class="btn btn-sm btn-primary" data-action="mark-sent" data-id="${o.id}">Mark as Sent</button>` : ''}
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

  function renderContacts() {
    main().innerHTML = `
      <div class="page">
        <div class="page-head">
          <h1>Contacts</h1>
          <p class="muted">Every number you open WhatsApp for is remembered here. Adding details is optional.</p>
        </div>
        <div class="toolbar">
          <input id="contact-search" type="search" placeholder="Search leads…" value="${esc(ui.contactSearch)}">
          <span class="spacer"></span>
          <button class="btn" data-action="import-csv">Import CSV</button>
          <button class="btn" data-action="export-csv">Export CSV</button>
          <button class="btn btn-primary" data-action="edit-contact">+ Add lead</button>
        </div>
        <section class="card flush"><div id="contacts-body"></div></section>
      </div>`;
    const s = $('#contact-search');
    s.addEventListener('input', () => { ui.contactSearch = s.value; renderContactsBody(); });
    renderContactsBody();
  }

  function renderContactsBody() {
    const q = ui.contactSearch.trim().toLowerCase();
    const rows = db.contacts
      .filter((c) => !q || CONTACT_FIELDS.map(([k]) => c[k]).join(' ').toLowerCase().includes(q))
      .sort((a, b) => (b.lastOpenedAt || b.createdAt || '').localeCompare(a.lastOpenedAt || a.createdAt || ''));
    const body = $('#contacts-body');
    if (!rows.length) {
      body.innerHTML = `<div class="empty">${db.contacts.length ? 'Nothing matches.' : 'No contacts yet. Open WhatsApp from Quick Send, add a lead, or import a CSV of your lead database.'}</div>`;
      return;
    }
    body.innerHTML = `
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Property</th><th>Contact</th><th>Number</th><th>Location</th><th>Type</th><th>Last contacted</th><th>Status</th><th class="right">Actions</th></tr></thead>
        <tbody>${rows.map((c) => {
          const st = contactStatus(c);
          const links = [
            c.website ? `<a href="${esc(/^https?:/.test(c.website) ? c.website : 'https://' + c.website)}" target="_blank" rel="noopener">web</a>` : '',
            c.instagram ? `<a href="https://instagram.com/${esc(c.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, ''))}" target="_blank" rel="noopener">ig</a>` : '',
            c.email ? `<a href="mailto:${esc(c.email)}">email</a>` : '',
          ].filter(Boolean).join(' · ');
          return `<tr>
            <td><strong>${esc(c.propertyName || '—')}</strong>${links ? `<div class="small">${links}</div>` : ''}</td>
            <td>${esc(c.name || '')}${c.notes ? `<div class="muted small clamp" title="${esc(c.notes)}">${esc(c.notes)}</div>` : ''}</td>
            <td class="mono nowrap">${esc(L.formatPhone(c.phone))}</td>
            <td>${esc([c.city, c.country].filter(Boolean).join(', '))}</td>
            <td>${esc(c.propertyType || '')}</td>
            <td class="nowrap">${esc(fmtRelative(c.lastSentAt || c.lastOpenedAt))}</td>
            <td><span class="pill pill-${st.key}">${esc(st.label)}</span></td>
            <td class="right nowrap">
              <button class="btn btn-sm btn-primary" data-action="load-contact" data-id="${c.id}">Message →</button>
              <button class="btn btn-sm" data-action="edit-contact" data-id="${c.id}">Edit</button>
              <button class="btn btn-sm btn-ghost danger" data-action="delete-contact" data-id="${c.id}" aria-label="Delete contact">✕</button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
      <div class="table-foot muted small">${rows.length} of ${db.contacts.length} contacts</div>`;
  }

  function editContactModal(id) {
    const c = id ? getContact(id) : null;
    const v = (k) => esc(c ? (k === 'phone' ? L.formatPhone(c.phone) : c[k] || '') : '');
    openModal(c ? 'Edit lead' : 'Add lead', `
      <form id="contact-form" class="vars-grid">
        ${CONTACT_FIELDS.map(([k, label]) => k === 'notes'
          ? `<div class="field span-2"><label for="cf-${k}">${label}</label><textarea id="cf-${k}" name="${k}" rows="3">${v(k)}</textarea></div>`
          : `<div class="field"><label for="cf-${k}">${label}${k === 'phone' ? ' *' : ''}</label><input id="cf-${k}" name="${k}" value="${v(k)}" ${k === 'phone' ? 'type="tel" required placeholder="+57 300 123 4567"' : ''} ${k === 'propertyType' ? 'list="pt-list"' : ''} autocomplete="off"></div>`).join('')}
        <div class="span-2 row-end">
          <button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn btn-primary">Save lead</button>
        </div>
      </form>`, (root) => {
      const form = $('#contact-form', root);
      $('input', form).focus();
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        const n = L.normalizePhone(data.phone, db.settings.defaultCountryCode);
        if (!n.ok) { toast(n.error || 'Enter a WhatsApp number.', 'warn'); $('#cf-phone', form).focus(); return; }
        const dupe = contactByPhone(n.digits);
        if (dupe && (!c || dupe.id !== c.id)) { toast(`${L.formatPhone(n.digits)} already belongs to ${contactLabel(dupe)}.`, 'warn'); return; }
        const target = c || { id: uid(), extra: {}, createdAt: nowIso(), lastOpenedAt: null, lastSentAt: null, followUp: null };
        CONTACT_FIELDS.forEach(([k]) => { target[k] = k === 'phone' ? n.digits : (data[k] || '').trim(); });
        if (!c) db.contacts.unshift(target);
        save();
        closeModal();
        toast(`Saved ${contactLabel(target)}`);
        if (ui.view === 'contacts') renderContactsBody();
      });
    });
  }

  const HEADER_MAP = {
    name: ['name', 'full name', 'contact', 'contact name', 'owner', 'owner name', 'first name', 'host', 'manager'],
    propertyName: ['property', 'property name', 'business', 'business name', 'listing', 'hotel', 'company'],
    phone: ['phone', 'whatsapp', 'whatsapp number', 'number', 'mobile', 'phone number', 'cell', 'telephone', 'tel'],
    country: ['country'],
    city: ['city', 'town', 'location'],
    propertyType: ['property type', 'type', 'category', 'segment'],
    website: ['website', 'url', 'site', 'web'],
    instagram: ['instagram', 'ig', 'instagram handle'],
    email: ['email', 'e-mail', 'mail'],
    notes: ['notes', 'note', 'comments', 'comment'],
  };

  function importCSV(text) {
    const rows = L.parseCSV(text);
    if (rows.length < 2) { toast('That CSV looks empty.', 'warn'); return; }
    const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/[_-]+/g, ' '));
    const col = {};
    for (const [field, names] of Object.entries(HEADER_MAP)) {
      const i = headers.findIndex((h) => names.includes(h));
      if (i >= 0) col[field] = i;
    }
    if (col.phone == null) { toast('No phone/WhatsApp column found. Name one column “phone” or “whatsapp”.', 'warn'); return; }
    let added = 0; let updated = 0; let skipped = 0;
    for (const r of rows.slice(1)) {
      const n = L.normalizePhone(r[col.phone], db.settings.defaultCountryCode);
      if (!n.ok) { skipped++; continue; }
      const exists = contactByPhone(n.digits);
      const patch = {};
      for (const field of Object.keys(HEADER_MAP)) {
        if (field === 'phone' || col[field] == null) continue;
        const val = (r[col[field]] || '').trim();
        if (val && (!exists || !exists[field])) patch[field] = val;
      }
      upsertContact(n.digits, patch);
      if (exists) updated++; else added++;
    }
    save();
    if (ui.view === 'contacts') renderContactsBody();
    toast(`Imported ${added} new, updated ${updated}${skipped ? `, skipped ${skipped} without a valid number` : ''}.`);
  }

  function exportCSV() {
    const rows = [CONTACT_FIELDS.map(([, l]) => l).concat(['Last opened', 'Last sent', 'Follow-up due'])];
    db.contacts.forEach((c) => rows.push(CONTACT_FIELDS.map(([k]) => (k === 'phone' ? L.formatPhone(c.phone) : c[k] || ''))
      .concat([c.lastOpenedAt || '', c.lastSentAt || '', c.followUp ? c.followUp.due : ''])));
    download(`roam-leads-${L.localDate(new Date())}.csv`, L.toCSV(rows), 'text/csv');
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
        <section class="card">
          <h2>Data</h2>
          <p class="muted small">Everything is stored in this browser only (${db.contacts.length} contacts, ${db.outreach.length} outreach entries, ${db.templates.length} templates). Export a backup regularly, and use it to move to another computer.</p>
          <div class="row">
            <button class="btn" data-action="backup-export">Export backup (.json)</button>
            <button class="btn" data-action="backup-import">Restore backup…</button>
            <button class="btn" data-action="restore-templates">Restore default templates</button>
          </div>
          <div class="row"><button class="btn btn-ghost danger" data-action="wipe">Erase all data…</button></div>
        </section>
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

  function closeModal() {
    const root = $('#modal');
    root.hidden = true;
    root.innerHTML = '';
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
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
      if (ui.view === 'history') {
        renderHistoryBody();
        const o = getOutreach(el.dataset.id);
        if (o) rescheduleModal(o.contactId);
      }
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
    'qs-clear': () => clearQuickSend(),
    'save-lead': () => saveLeadFromQS(),

    'history-filter': (el) => { ui.historyFilter = el.dataset.f; renderHistory(); },
    'delete-outreach': (el) => {
      if (!confirm('Delete this outreach entry?')) return;
      db.outreach = db.outreach.filter((o) => o.id !== el.dataset.id);
      save(); renderHistory();
    },

    'edit-contact': (el) => editContactModal(el.dataset.id),
    'delete-contact': (el) => {
      const c = getContact(el.dataset.id);
      if (!c || !confirm(`Delete ${contactLabel(c)}? Their outreach history is kept.`)) return;
      db.contacts = db.contacts.filter((x) => x.id !== c.id);
      if (ui.qs.contactId === c.id) ui.qs.contactId = null;
      save(); renderContactsBody(); updateNavBadge();
    },
    'import-csv': () => pickFile('.csv,text/csv', importCSV),
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
      if (!t || !confirm(`Delete “${t.name}”? History entries keep their message text.`)) return;
      db.templates = db.templates.filter((x) => x.id !== t.id); save();
      ui.tplSelected = null; renderTemplates();
    },
    'tpl-insert': (el) => insertAtCursor($('#tpl-body'), `{{${el.dataset.var}}}`),
    'tpl-use': () => {
      const t = getTemplate(ui.tplSelected);
      if (!t.active) { t.active = true; save(); }
      ui.qs.templateId = t.id; ui.qs.override = null; ui.qs.isFollowUp = false;
      go('send');
    },

    'backup-export': () => download(`roam-whatsapp-backup-${L.localDate(new Date())}.json`, JSON.stringify(db, null, 2), 'application/json'),
    'backup-import': () => pickFile('.json,application/json', (text) => {
      try {
        const data = JSON.parse(text);
        if (!Array.isArray(data.templates) || !Array.isArray(data.contacts) || !Array.isArray(data.outreach)) throw new Error('bad');
        if (!confirm(`Replace current data with this backup (${data.contacts.length} contacts, ${data.outreach.length} outreach entries)?`)) return;
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
    wipe: () => {
      if (!confirm('Erase all contacts, history and templates from this browser? Export a backup first if unsure.')) return;
      db = freshDb(); save(); ui.qs = freshQS(); ui.pending = null; go('send');
      toast('All data erased');
    },
    'close-modal': () => closeModal(),
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
    else if (e.altKey && e.code === 'KeyN') { e.preventDefault(); clearQuickSend(); }
  });

  // Another tab changed the data (e.g. two console tabs open) — reload it.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORE_KEY) return;
    db = load();
    if (ui.view !== 'send') render(); else { renderRecents(); updateNavBadge(); }
  });

  window.addEventListener('hashchange', render);

  // Datalists shared across forms.
  document.body.insertAdjacentHTML('beforeend',
    `<datalist id="pt-list">${PROPERTY_TYPES.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>` +
    `<datalist id="cat-list">${CATEGORIES.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>`);

  save(); // Persist first-run seed data and any template migrations.
  render();
})();
