/*
 * Pure helpers for the Roam WhatsApp console: template variables, phone
 * normalization, click-to-chat links, CSV parsing and date math.
 * Loaded as a classic script (window.RoamLib) so index.html works from file://,
 * and exported for Node so the logic can be unit tested.
 */
(function (root) {
  'use strict';

  const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

  /** Unique variable names in order of first appearance, lowercased. */
  function extractVariables(text) {
    const vars = [];
    for (const m of String(text || '').matchAll(VAR_RE)) {
      const key = m[1].toLowerCase();
      if (!vars.includes(key)) vars.push(key);
    }
    return vars;
  }

  function valueFor(values, key) {
    const v = values && values[key];
    return v == null ? '' : String(v).trim();
  }

  /**
   * Split a template into literal text and variable segments so the UI can
   * highlight filled and missing values.
   */
  function templateSegments(text, values) {
    const src = String(text || '');
    const out = [];
    let last = 0;
    for (const m of src.matchAll(VAR_RE)) {
      if (m.index > last) out.push({ type: 'text', text: src.slice(last, m.index) });
      const key = m[1].toLowerCase();
      const v = valueFor(values, key);
      out.push(v ? { type: 'var', key, text: v } : { type: 'missing', key, text: m[0] });
      last = m.index + m[0].length;
    }
    if (last < src.length) out.push({ type: 'text', text: src.slice(last) });
    return out;
  }

  /** Fill {{variables}}; unfilled ones are left as-is so they are visible. */
  function renderTemplate(text, values) {
    return templateSegments(text, values).map((s) => s.text).join('');
  }

  function missingVariables(text, values) {
    return extractVariables(text).filter((k) => !valueFor(values, k));
  }

  /**
   * Normalize a typed phone number to the digits-only international form that
   * WhatsApp click-to-chat expects (country code, no +, no leading zeros).
   *
   * - "+57 300 123 4567"  -> 573001234567
   * - "0057 300 123 4567" -> 573001234567
   * - "300 123 4567" with defaultCountryCode "57" -> 573001234567
   * - "07700 900123" with defaultCountryCode "44" -> 447700900123 (trunk 0 dropped)
   */
  function normalizePhone(input, defaultCountryCode) {
    const raw = String(input || '').trim();
    if (!raw) return { ok: false, digits: '', error: '' };
    let digits = raw.replace(/\D/g, '');
    const cc = String(defaultCountryCode || '').replace(/\D/g, '');

    if (raw.startsWith('+')) {
      // Already international.
    } else if (digits.startsWith('00')) {
      digits = digits.slice(2);
    } else if (cc) {
      const alreadyHasCc = digits.startsWith(cc) && digits.length > 10;
      if (!alreadyHasCc) digits = cc + digits.replace(/^0+/, '');
    } else if (digits.length <= 10) {
      return {
        ok: false,
        digits,
        error: 'Add the country code (e.g. +57), or set a default country code in Settings.',
      };
    }

    if (digits.length < 8) return { ok: false, digits, error: 'That number looks too short.' };
    if (digits.length > 15) return { ok: false, digits, error: 'That number looks too long.' };
    return { ok: true, digits, error: '' };
  }

  function formatPhone(digits) {
    return digits ? '+' + String(digits).replace(/\D/g, '') : '';
  }

  /**
   * Click-to-chat URL. Modes:
   *  - "web": WhatsApp Web, opens straight into the chat (best on desktop)
   *  - "app": the installed WhatsApp desktop/mobile app
   *  - "wa":  wa.me universal link (best on phones)
   */
  function buildWhatsAppUrl(digits, message, mode) {
    const phone = String(digits || '').replace(/\D/g, '');
    const text = encodeURIComponent(message || '');
    if (mode === 'web') return `https://web.whatsapp.com/send?phone=${phone}&text=${text}`;
    if (mode === 'app') return `whatsapp://send?phone=${phone}&text=${text}`;
    return `https://wa.me/${phone}?text=${text}`;
  }

  function firstName(fullName) {
    return String(fullName || '').trim().split(/\s+/)[0] || '';
  }

  /** Local calendar date as YYYY-MM-DD. */
  function localDate(d) {
    const date = d instanceof Date ? d : new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function addDays(from, days) {
    const d = from instanceof Date ? new Date(from.getTime()) : new Date(from);
    d.setDate(d.getDate() + days);
    return localDate(d);
  }

  /** Whole days from today until a YYYY-MM-DD date (negative = overdue). */
  function daysUntil(ymd, today) {
    const [y, m, d] = String(ymd).split('-').map(Number);
    const t = today || new Date();
    const a = Date.UTC(y, m - 1, d);
    const b = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
    return Math.round((a - b) / 86400000);
  }

  /** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). Also handles tab- or semicolon-separated text. */
  function parseCSV(text, delimiter) {
    const delim = delimiter || ',';
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    const src = String(text || '').replace(/^﻿/, '');
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (quoted) {
        if (ch === '"') {
          if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
        } else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === delim) { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && src[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
  }

  function toCSV(rows) {
    return rows
      .map((r) => r.map((c) => {
        const s = c == null ? '' : String(c);
        return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(','))
      .join('\r\n');
  }

  /** Column names recognised in pasted or imported lead lists (lowercase, "_" and "-" read as spaces). */
  const LEAD_HEADERS = {
    name: ['name', 'full name', 'contact', 'contact name', 'owner', 'owner name', 'first name', 'host', 'manager'],
    propertyName: ['property', 'property name', 'business', 'business name', 'listing', 'hotel', 'company', 'villa'],
    phone: ['phone', 'whatsapp', 'whatsapp number', 'number', 'mobile', 'phone number', 'cell', 'telephone', 'tel', 'wa'],
    country: ['country'],
    city: ['city', 'town', 'location', 'area', 'place'],
    propertyType: ['property type', 'type', 'category', 'segment'],
    website: ['website', 'url', 'site', 'web'],
    instagram: ['instagram', 'ig', 'instagram handle'],
    email: ['email', 'e-mail', 'mail'],
    notes: ['notes', 'note', 'comments', 'comment'],
    folder: ['folder', 'list', 'group'],
  };

  function detectDelimiter(text) {
    const first = String(text || '').split(/\r?\n/).find((l) => l.trim()) || '';
    if (first.includes('\t')) return '\t';
    const count = (ch) => first.split(ch).length - 1;
    return count(';') > count(',') ? ';' : ',';
  }

  /** A cell that is only a phone number: 8-15 digits plus spaces, +, (), dots or dashes. */
  function looksLikePhone(cell) {
    const s = String(cell || '').trim();
    const digits = s.replace(/\D/g, '').length;
    return /^[+\d\s().-]+$/.test(s) && digits >= 8 && digits <= 15;
  }

  /** Map a header row to column indexes, or null when the row isn't a header (no phone column). */
  function mapLeadHeaders(cells) {
    const headers = cells.map((h) => String(h).trim().toLowerCase().replace(/[_-]+/g, ' '));
    const col = {};
    for (const [field, names] of Object.entries(LEAD_HEADERS)) {
      const i = headers.findIndex((h) => names.includes(h));
      if (i >= 0) col[field] = i;
    }
    return col.phone == null ? null : col;
  }

  /**
   * Parse leads pasted from a spreadsheet, a CSV file or plain lines.
   * With a header row, columns are matched by name. Without one, the phone number
   * is found in each row, and the other cells are read as property name, location, notes.
   * Duplicate numbers within the paste are merged.
   */
  function parseLeads(text, defaultCountryCode) {
    const rows = parseCSV(text, detectDelimiter(text)).map((r) => r.map((c) => c.trim()));
    const col = rows.length ? mapLeadHeaders(rows[0]) : null;
    const leads = [];
    const skipped = [];
    const byPhone = {};
    for (const cells of col ? rows.slice(1) : rows) {
      let lead;
      let rawPhone;
      if (col) {
        rawPhone = cells[col.phone];
        lead = {};
        for (const field of Object.keys(LEAD_HEADERS)) {
          if (field !== 'phone' && col[field] != null && cells[col[field]]) lead[field] = cells[col[field]];
        }
      } else {
        const pi = cells.findIndex(looksLikePhone);
        rawPhone = pi >= 0 ? cells[pi] : '';
        const rest = cells.filter((c, i) => i !== pi); // keep blanks so columns stay in place
        lead = {};
        if (rest[0]) lead.propertyName = rest[0];
        if (rest[1]) lead.city = rest[1];
        const notes = rest.slice(2).filter(Boolean);
        if (notes.length) lead.notes = notes.join(' · ');
      }
      const n = normalizePhone(rawPhone, defaultCountryCode);
      if (!n.ok) {
        skipped.push({ text: cells.filter(Boolean).join(', '), reason: rawPhone ? (n.error || 'Invalid number') : 'No phone number found' });
        continue;
      }
      lead.phone = n.digits;
      if (byPhone[n.digits]) {
        for (const [k, v] of Object.entries(lead)) if (!byPhone[n.digits][k]) byPhone[n.digits][k] = v;
      } else {
        byPhone[n.digits] = lead;
        leads.push(lead);
      }
    }
    return { leads, skipped, hasHeader: !!col };
  }

  const api = {
    extractVariables, templateSegments, renderTemplate, missingVariables,
    normalizePhone, formatPhone, buildWhatsAppUrl, firstName,
    localDate, addDays, daysUntil, parseCSV, toCSV,
    LEAD_HEADERS, looksLikePhone, mapLeadHeaders, parseLeads,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RoamLib = api;
})(typeof window !== 'undefined' ? window : globalThis);
