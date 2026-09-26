/*
 * Supabase sync for the Roam WhatsApp console.
 *
 * The app keeps working on an in-memory `db` object. This module maps it to
 * the wa_* tables, loads it on sign-in, and pushes changes by diffing the
 * current state against a snapshot of what the server last had.
 */
(function (root) {
  'use strict';

  const cfg = root.ROAM_CONFIG || {};
  const enabled = !!(cfg.supabaseUrl && cfg.supabaseKey && root.supabase && root.supabase.createClient);
  const client = enabled ? root.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  }) : null;

  const PAGE = 1000;
  const CHUNK = 500;
  const orNull = (v) => (v === undefined || v === '' ? null : v);

  // ---------------------------------------------------------------------------
  // Row mapping (app shape <-> table columns)
  // ---------------------------------------------------------------------------

  const map = {
    folders: {
      table: 'wa_folders',
      order: ['created_at', true],
      toRow: (f) => ({ id: f.id, name: f.name || '', created_at: f.createdAt || new Date().toISOString() }),
      fromRow: (r) => ({ id: r.id, name: r.name, createdAt: r.created_at }),
    },
    templates: {
      table: 'wa_templates',
      order: ['created_at', true],
      toRow: (t) => ({
        id: t.id, name: t.name || '', category: t.category || '', body: t.body || '',
        active: t.active !== false, created_at: t.createdAt || new Date().toISOString(), updated_at: orNull(t.updatedAt),
      }),
      fromRow: (r) => ({
        id: r.id, name: r.name, category: r.category, body: r.body, active: r.active,
        createdAt: r.created_at, ...(r.updated_at ? { updatedAt: r.updated_at } : {}),
      }),
    },
    contacts: {
      table: 'wa_contacts',
      order: ['created_at', false],
      toRow: (c) => ({
        id: c.id, phone: c.phone, name: c.name || '', property_name: c.propertyName || '',
        country: c.country || '', city: c.city || '', property_type: c.propertyType || '',
        website: c.website || '', instagram: c.instagram || '', email: c.email || '', notes: c.notes || '',
        extra: c.extra || {}, folder_id: orNull(c.folderId), created_at: c.createdAt || new Date().toISOString(),
        last_opened_at: orNull(c.lastOpenedAt), last_sent_at: orNull(c.lastSentAt),
        follow_up_due: c.followUp ? c.followUp.due : null,
        follow_up_template_id: c.followUp ? orNull(c.followUp.templateId) : null,
        follow_up_created_at: c.followUp ? orNull(c.followUp.createdAt) : null,
      }),
      fromRow: (r) => ({
        id: r.id, phone: r.phone, name: r.name, propertyName: r.property_name, country: r.country,
        city: r.city, propertyType: r.property_type, website: r.website, instagram: r.instagram,
        email: r.email, notes: r.notes, extra: r.extra || {}, folderId: r.folder_id || null, createdAt: r.created_at,
        lastOpenedAt: r.last_opened_at, lastSentAt: r.last_sent_at,
        followUp: r.follow_up_due
          ? { due: r.follow_up_due, templateId: r.follow_up_template_id, createdAt: r.follow_up_created_at }
          : null,
      }),
    },
    outreach: {
      table: 'wa_outreach',
      order: ['opened_at', false],
      toRow: (o) => ({
        id: o.id, contact_id: orNull(o.contactId), phone: o.phone, contact_name: o.contactName || '',
        property_name: o.propertyName || '', template_id: orNull(o.templateId), template_name: o.templateName || '',
        message: o.message || '', status: o.status === 'sent' ? 'sent' : 'opened',
        opened_at: o.openedAt, sent_at: orNull(o.sentAt), is_follow_up: !!o.isFollowUp,
      }),
      fromRow: (r) => ({
        id: r.id, contactId: r.contact_id, phone: r.phone, contactName: r.contact_name,
        propertyName: r.property_name, templateId: r.template_id, templateName: r.template_name,
        message: r.message, status: r.status, openedAt: r.opened_at, sentAt: r.sent_at, isFollowUp: r.is_follow_up,
      }),
    },
  };

  const settingsToRow = (s, userId) => ({
    user_id: userId,
    default_country_code: s.defaultCountryCode || '',
    open_mode: s.openMode || 'auto',
    last_template_id: orNull(s.lastTemplateId),
    counter_reset_at: orNull(s.counterResetAt),
  });
  const settingsFromRow = (r) => ({
    defaultCountryCode: r.default_country_code, openMode: r.open_mode, lastTemplateId: r.last_template_id,
    counterResetAt: r.counter_reset_at || null,
  });

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  let user = null;

  async function getSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    user = data.session ? data.session.user : null;
    return data.session;
  }

  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    user = data.user;
    return data.session;
  }

  async function signUp(email, password) {
    const redirect = /^https?:/.test(location.protocol) ? location.origin + location.pathname : undefined;
    const { data, error } = await client.auth.signUp({ email, password, options: redirect ? { emailRedirectTo: redirect } : {} });
    if (error) throw error;
    user = data.session ? data.user : null;
    return data.session; // null when the email must be confirmed first
  }

  async function signOut() {
    await client.auth.signOut();
    user = null;
  }

  // ---------------------------------------------------------------------------
  // Pull / push
  // ---------------------------------------------------------------------------

  async function fetchAll(table, [column, ascending]) {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await client.from(table).select('*').order(column, { ascending }).range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...data);
      if (data.length < PAGE) return rows;
    }
  }

  /** Load everything for the signed-in user. `empty` is true on a brand-new account. */
  async function pull() {
    const [folders, templates, contacts, outreach, settingsRows] = await Promise.all([
      fetchAll(map.folders.table, map.folders.order),
      fetchAll(map.templates.table, map.templates.order),
      fetchAll(map.contacts.table, map.contacts.order),
      fetchAll(map.outreach.table, map.outreach.order),
      client.from('wa_settings').select('*').limit(1).then(({ data, error }) => { if (error) throw error; return data; }),
    ]);
    return {
      empty: !folders.length && !templates.length && !contacts.length && !outreach.length && !settingsRows.length,
      data: {
        folders: folders.map(map.folders.fromRow),
        templates: templates.map(map.templates.fromRow),
        contacts: contacts.map(map.contacts.fromRow),
        outreach: outreach.map(map.outreach.fromRow),
        settings: settingsRows[0] ? settingsFromRow(settingsRows[0]) : {},
      },
    };
  }

  /** Serialized rows keyed by id, used to detect what changed since the last sync. */
  function snapshot(db) {
    const snap = {};
    for (const [coll, m] of Object.entries(map)) {
      snap[coll] = {};
      for (const item of db[coll] || []) snap[coll][item.id] = JSON.stringify(m.toRow(item));
    }
    snap.settings = JSON.stringify(settingsToRow(db.settings || {}, user && user.id));
    return snap;
  }

  function chunks(list) {
    const out = [];
    for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
    return out;
  }

  /**
   * Send the differences between `db` and `prev` (the last synced snapshot).
   * With no `prev`, everything is upserted and nothing deleted.
   * Returns the snapshot to diff against next time.
   */
  async function push(db, prev) {
    if (!user) throw new Error('Not signed in');
    const next = snapshot(db);

    // Deletes first so a re-added phone number doesn't collide with the old row.
    for (const coll of ['outreach', 'contacts', 'templates', 'folders']) {
      if (!prev) break;
      const gone = Object.keys(prev[coll] || {}).filter((id) => !(id in next[coll]));
      for (const ids of chunks(gone)) {
        const { error } = await client.from(map[coll].table).delete().in('id', ids);
        if (error) throw error;
      }
    }

    for (const coll of ['folders', 'templates', 'contacts', 'outreach']) {
      const before = (prev && prev[coll]) || {};
      const changed = Object.entries(next[coll]).filter(([id, json]) => before[id] !== json).map(([, json]) => JSON.parse(json));
      for (const rows of chunks(changed)) {
        const { error } = await client.from(map[coll].table).upsert(rows, { onConflict: 'id' });
        if (error) throw error;
      }
    }

    if (!prev || prev.settings !== next.settings) {
      const { error } = await client.from('wa_settings').upsert(JSON.parse(next.settings), { onConflict: 'user_id' });
      if (error) throw error;
    }
    return next;
  }

  /** Whether the Supabase API answers at all (it may be blocked by the network or the hosting page). */
  async function reachable() {
    try {
      const res = await fetch(cfg.supabaseUrl + '/auth/v1/health', { headers: { apikey: cfg.supabaseKey } });
      return res.status < 500;
    } catch (e) {
      return false;
    }
  }

  root.RoamCloud = {
    enabled,
    get user() { return user; },
    getSession, signIn, signUp, signOut, pull, push, snapshot, reachable,
    onAuthChange: (cb) => client && client.auth.onAuthStateChange((event, session) => cb(event, session)),
  };
})(window);
