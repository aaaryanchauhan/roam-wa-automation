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

  /** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
  function parseCSV(text) {
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
      else if (ch === ',') { row.push(field); field = ''; }
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

  const api = {
    extractVariables, templateSegments, renderTemplate, missingVariables,
    normalizePhone, formatPhone, buildWhatsAppUrl, firstName,
    localDate, addDays, daysUntil, parseCSV, toCSV,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RoamLib = api;
})(typeof window !== 'undefined' ? window : globalThis);
